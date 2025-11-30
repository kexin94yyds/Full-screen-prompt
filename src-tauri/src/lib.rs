use tauri::Manager;

#[cfg(target_os = "macos")]
mod macos {
    use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGKeyCode};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    use std::thread;
    use std::time::Duration;

    // macOS key code for 'V'
    const KEY_CODE_V: CGKeyCode = 9;

    /// 使用 CGEvent API 模拟 Cmd+V（与 ClipBook 相同的方式）
    pub fn simulate_paste() -> Result<(), String> {
        let source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
            .map_err(|_| "Failed to create event source")?;

        // 创建 key down 事件
        let key_down = CGEvent::new_keyboard_event(source.clone(), KEY_CODE_V, true)
            .map_err(|_| "Failed to create key down event")?;
        key_down.set_flags(CGEventFlags::CGEventFlagCommand);

        // 创建 key up 事件
        let key_up = CGEvent::new_keyboard_event(source, KEY_CODE_V, false)
            .map_err(|_| "Failed to create key up event")?;

        // 发送事件
        key_down.post(CGEventTapLocation::HID);
        key_up.post(CGEventTapLocation::HID);

        // 等待目标应用处理（类似 ClipBook 的 50ms）
        thread::sleep(Duration::from_millis(50));

        Ok(())
    }

    /// 检查辅助功能权限
    pub fn check_accessibility_permission() -> bool {
        #[link(name = "ApplicationServices", kind = "framework")]
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
        }
        unsafe { AXIsProcessTrusted() }
    }

    /// 记录当前前台应用（空实现，激活由系统自动处理）
    pub fn save_frontmost_app_pid() {
        // 不需要记录，隐藏窗口后系统会自动激活之前的应用
    }
    
    /// 激活之前的应用（等待系统自动激活）
    pub fn activate_previous_app() {
        // 隐藏窗口后系统会自动激活之前的应用
        // 只需要等待足够的时间让系统完成激活
        thread::sleep(Duration::from_millis(150));
    }
}

#[cfg(target_os = "macos")]
use macos::*;

/// 执行粘贴操作的 Tauri 命令
#[tauri::command]
async fn paste_text() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        simulate_paste()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Paste not supported on this platform".to_string())
    }
}

/// 写入剪贴板并粘贴
#[tauri::command]
async fn insert_and_paste(text: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    
    // 写入剪贴板
    app.clipboard().write_text(&text)
        .map_err(|e| format!("Failed to write to clipboard: {}", e))?;
    
    // 隐藏窗口
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    
    #[cfg(target_os = "macos")]
    {
        // 激活之前记录的应用（通过 PID，与 ClipBook 相同）
        activate_previous_app();
        // 执行粘贴
        simulate_paste()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Paste not supported on this platform".to_string())
    }
}

/// 写入剪贴板
#[tauri::command]
async fn write_clipboard(text: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard().write_text(&text)
        .map_err(|e| format!("Failed to write to clipboard: {}", e))
}

/// 检查辅助功能权限
#[tauri::command]
fn check_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        check_accessibility_permission()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            // 注册全局快捷键 Shift+Cmd+P
            use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
            
            let shortcut: Shortcut = "Shift+CommandOrControl+P".parse().unwrap();
            let app_handle = app.handle().clone();
            
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, _shortcut, event| {
                        if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            if let Some(window) = _app.get_webview_window("main") {
                                // 使用 is_focused 作为备选检查
                                let is_visible = window.is_visible().unwrap_or(false);
                                let is_focused = window.is_focused().unwrap_or(false);
                                
                                if is_visible || is_focused {
                                    let _ = window.hide();
                                } else {
                                    // 在显示窗口前，保存当前前台应用的 PID（与 ClipBook 相同）
                                    #[cfg(target_os = "macos")]
                                    save_frontmost_app_pid();
                                    
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .build(),
            )?;
            
            app.global_shortcut().register(shortcut)?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            paste_text,
            insert_and_paste,
            write_clipboard,
            check_permission
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
