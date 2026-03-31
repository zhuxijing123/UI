# src/app.py - 应用程序主类
import os
import tkinter as tk
from .controllers.main_controller import MainController
from .views.main_view import MainView
from .models.sprite_manager import SpriteManager
from .utils.logger import Logger
from .utils.config_manager import ConfigManager
from .utils.memory_manager import MemoryManager
from .utils.image_optimizer import ImageOptimizer
from .utils.plugin_manager import PluginManager
from .utils.event_system import event_system, EventTypes
from .utils.state_manager import StateManager


class SpriteViewerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("序列帧素材查看器")
        
        # 初始化配置管理器
        self.config_manager = ConfigManager()
        
        # 设置窗口大小
        window_size = self.config_manager.get_window_size()
        self.root.geometry(f"{window_size[0]}x{window_size[1]}")
        
        # 初始化日志系统
        self.logger = Logger(self.root)
        
        # 初始化内存管理器
        self.memory_manager = MemoryManager(self.config_manager)
        
        # 初始化图像优化器
        self.image_optimizer = ImageOptimizer(self.config_manager)
        
        # 初始化插件管理器
        self.plugin_manager = PluginManager(self.config_manager)
        
        # 初始化状态管理器
        self.state_manager = StateManager(self.config_manager)
        
        # 初始化模型
        self.sprite_manager = SpriteManager(self.logger, self.config_manager)
        
        # 初始化视图
        self.main_view = MainView(self.root, self.logger)
        
        # 初始化控制器
        self.main_controller = MainController(
            self.sprite_manager,
            self.main_view,
            self.logger,
            self.config_manager,
            self.memory_manager,
            self.image_optimizer,
            self.plugin_manager,
            self.state_manager
        )
        
        # 连接视图和控制器
        self.main_view.set_controller(self.main_controller)
        
        # 自动设置当前目录作为基础路径（如果存在scene或map文件夹）
        current_dir = os.getcwd()
        if os.path.exists(os.path.join(current_dir, "scene")) or os.path.exists(os.path.join(current_dir, "map")):
            self.sprite_manager.set_base_path(current_dir)
            self.logger.log(f"自动设置基础路径: {current_dir}", "INFO")
        
        # 启动性能监控
        self.memory_manager.start_monitoring()
        
        # 发布应用程序启动事件
        event_system.publish(EventTypes.APP_START, {
            'config': self.config_manager.config,
            'plugins': self.plugin_manager.get_plugin_info()
        })
        
        self.logger.log("应用程序初始化完成", "INFO")
        
        # 应用程序启动完成，默认已选择场景素材并显示子类型选择
        
        # 绑定窗口关闭事件
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
    
    def on_closing(self):
        """应用程序关闭处理"""
        try:
            # 发布应用程序退出事件
            event_system.publish(EventTypes.APP_EXIT, {
                'state': self.state_manager.get_state_summary()
            })
            
            # 停止性能监控
            self.memory_manager.stop_monitoring()
            
            # 清理插件
            self.plugin_manager.cleanup()
            
            # 保存配置
            self.config_manager.save_config()
            
            # 保存状态
            self.state_manager.save_state()
            
            self.logger.log("应用程序正常退出", "INFO")
            
        except Exception as e:
            self.logger.log(f"应用程序退出时发生错误: {e}", "ERROR")
        
        finally:
            self.root.destroy()