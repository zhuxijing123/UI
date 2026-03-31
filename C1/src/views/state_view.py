# src/views/state_view.py - 状态显示窗口
import tkinter as tk
from tkinter import ttk
from typing import Dict, Any
import threading
import time


class StateView:
    """状态显示窗口"""
    
    def __init__(self, root, state_manager, memory_manager, config_manager, plugin_manager=None):
        self.root = root
        self.state_manager = state_manager
        self.memory_manager = memory_manager
        self.config_manager = config_manager
        self.plugin_manager = plugin_manager
        
        self.window = None
        self.update_thread = None
        self.running = False
        
        # 创建状态显示窗口
        self.create_window()
        
        # 启动更新线程
        self.start_update_thread()
    
    def create_window(self):
        """创建状态显示窗口"""
        self.window = tk.Toplevel(self.root)
        self.window.title("应用程序状态")
        self.window.geometry("600x500")
        self.window.protocol("WM_DELETE_WINDOW", self.hide)
        
        # 创建主框架
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 创建选项卡
        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        # 基本状态选项卡
        self.create_basic_state_tab(notebook)
        
        # 性能状态选项卡
        self.create_performance_tab(notebook)
        
        # 配置状态选项卡
        self.create_config_tab(notebook)
        
        # 插件状态选项卡
        self.create_plugins_tab(notebook)
    
    def create_basic_state_tab(self, notebook):
        """创建基本状态选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="基本状态")
        
        # 当前素材信息
        sprite_frame = ttk.LabelFrame(frame, text="当前素材")
        sprite_frame.pack(fill=tk.X, pady=5)
        
        self.sprite_info_label = ttk.Label(sprite_frame, text="加载中...")
        self.sprite_info_label.pack(anchor=tk.W, padx=5, pady=2)
        
        # 动画状态
        animation_frame = ttk.LabelFrame(frame, text="动画状态")
        animation_frame.pack(fill=tk.X, pady=5)
        
        self.animation_info_label = ttk.Label(animation_frame, text="加载中...")
        self.animation_info_label.pack(anchor=tk.W, padx=5, pady=2)
        
        # 视图设置
        view_frame = ttk.LabelFrame(frame, text="视图设置")
        view_frame.pack(fill=tk.X, pady=5)
        
        self.view_info_label = ttk.Label(view_frame, text="加载中...")
        self.view_info_label.pack(anchor=tk.W, padx=5, pady=2)
        
        # 显示选项
        display_frame = ttk.LabelFrame(frame, text="显示选项")
        display_frame.pack(fill=tk.X, pady=5)
        
        self.display_info_label = ttk.Label(display_frame, text="加载中...")
        self.display_info_label.pack(anchor=tk.W, padx=5, pady=2)
    
    def create_performance_tab(self, notebook):
        """创建性能状态选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="性能状态")
        
        # 内存使用
        memory_frame = ttk.LabelFrame(frame, text="内存使用")
        memory_frame.pack(fill=tk.X, pady=5)
        
        self.memory_info_label = ttk.Label(memory_frame, text="加载中...")
        self.memory_info_label.pack(anchor=tk.W, padx=5, pady=2)
        
        # CPU使用
        cpu_frame = ttk.LabelFrame(frame, text="CPU使用")
        cpu_frame.pack(fill=tk.X, pady=5)
        
        self.cpu_info_label = ttk.Label(cpu_frame, text="加载中...")
        self.cpu_info_label.pack(anchor=tk.W, padx=5, pady=2)
        
        # 缓存状态
        cache_frame = ttk.LabelFrame(frame, text="缓存状态")
        cache_frame.pack(fill=tk.X, pady=5)
        
        self.cache_info_label = ttk.Label(cache_frame, text="加载中...")
        self.cache_info_label.pack(anchor=tk.W, padx=5, pady=2)
        
        # 性能统计
        stats_frame = ttk.LabelFrame(frame, text="性能统计")
        stats_frame.pack(fill=tk.X, pady=5)
        
        self.stats_info_label = ttk.Label(stats_frame, text="加载中...")
        self.stats_info_label.pack(anchor=tk.W, padx=5, pady=2)
    
    def create_config_tab(self, notebook):
        """创建配置状态选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="配置状态")
        
        # 导出设置
        export_frame = ttk.LabelFrame(frame, text="导出设置")
        export_frame.pack(fill=tk.X, pady=5)
        
        self.export_info_label = ttk.Label(export_frame, text="加载中...")
        self.export_info_label.pack(anchor=tk.W, padx=5, pady=2)
        
        # 图像设置
        image_frame = ttk.LabelFrame(frame, text="图像设置")
        image_frame.pack(fill=tk.X, pady=5)
        
        self.image_info_label = ttk.Label(image_frame, text="加载中...")
        self.image_info_label.pack(anchor=tk.W, padx=5, pady=2)
        
        # 性能设置
        perf_frame = ttk.LabelFrame(frame, text="性能设置")
        perf_frame.pack(fill=tk.X, pady=5)
        
        self.perf_info_label = ttk.Label(perf_frame, text="加载中...")
        self.perf_info_label.pack(anchor=tk.W, padx=5, pady=2)
        
        # UI设置
        ui_frame = ttk.LabelFrame(frame, text="UI设置")
        ui_frame.pack(fill=tk.X, pady=5)
        
        self.ui_info_label = ttk.Label(ui_frame, text="加载中...")
        self.ui_info_label.pack(anchor=tk.W, padx=5, pady=2)
    
    def create_plugins_tab(self, notebook):
        """创建插件状态选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="插件状态")
        
        # 插件列表
        plugins_frame = ttk.LabelFrame(frame, text="已加载插件")
        plugins_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 创建树形视图
        self.plugins_tree = ttk.Treeview(plugins_frame, columns=("version", "author", "enabled"), show="tree headings")
        self.plugins_tree.heading("#0", text="插件名称")
        self.plugins_tree.heading("version", text="版本")
        self.plugins_tree.heading("author", text="作者")
        self.plugins_tree.heading("enabled", text="状态")
        
        self.plugins_tree.column("#0", width=200)
        self.plugins_tree.column("version", width=80)
        self.plugins_tree.column("author", width=100)
        self.plugins_tree.column("enabled", width=60)
        
        # 添加滚动条
        scrollbar = ttk.Scrollbar(plugins_frame, orient="vertical", command=self.plugins_tree.yview)
        self.plugins_tree.configure(yscrollcommand=scrollbar.set)
        
        self.plugins_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def start_update_thread(self):
        """启动更新线程"""
        self.running = True
        self.update_thread = threading.Thread(target=self._update_loop, daemon=True)
        self.update_thread.start()
    
    def stop_update_thread(self):
        """停止更新线程"""
        self.running = False
        if self.update_thread:
            self.update_thread.join()
    
    def _update_loop(self):
        """更新循环"""
        while self.running:
            try:
                self.update_display()
                time.sleep(1)  # 每秒更新一次
            except Exception as e:
                print(f"状态更新错误: {e}")
    
    def update_display(self):
        """更新显示"""
        if not self.window or not self.window.winfo_exists():
            return
        
        try:
            # 更新基本状态
            self._update_basic_state()
            
            # 更新性能状态
            self._update_performance_state()
            
            # 更新配置状态
            self._update_config_state()
            
            # 更新插件状态
            self._update_plugins_state()
            
        except Exception as e:
            print(f"更新状态显示失败: {e}")
    
    def _update_basic_state(self):
        """更新基本状态"""
        try:
            state = self.state_manager.get_state()
            
            # 获取当前实际状态（从控制器获取）
            current_sprite_info = self.state_manager.get_current_sprite_info()
            
            # 更新素材信息
            sprite_type = current_sprite_info.get('type', state.current_sprite_type)
            sprite_id = current_sprite_info.get('id', state.current_sprite_id)
            sprite_info = f"类型: {sprite_type}, ID: {sprite_id}"
            self.sprite_info_label.config(text=sprite_info)
            
            # 更新动画信息
            action = current_sprite_info.get('action', state.current_action)
            direction = current_sprite_info.get('direction', state.current_direction)
            animation_info = f"动作: {action}, 方向: {direction}, 播放: {'是' if state.animation_playing else '否'}, 速度: {state.animation_speed}ms"
            self.animation_info_label.config(text=animation_info)
            
            # 更新视图信息
            view_info = f"缩放: {state.zoom_level:.2f}x, 偏移: ({state.offset_x}, {state.offset_y})"
            self.view_info_label.config(text=view_info)
            
            # 更新显示选项
            display_info = f"可通行: {'是' if state.show_walkable else '否'}, 不可通行: {'是' if state.show_blocked else '否'}, 遮罩: {'是' if state.show_masked else '否'}"
            self.display_info_label.config(text=display_info)
            
        except Exception as e:
            print(f"更新基本状态失败: {e}")
    
    def _update_performance_state(self):
        """更新性能状态"""
        try:
            # 获取内存使用信息
            memory_usage = self.memory_manager.get_memory_usage()
            if memory_usage:
                memory_info = f"物理内存: {memory_usage.get('rss', 0) / 1024 / 1024:.1f}MB, 虚拟内存: {memory_usage.get('vms', 0) / 1024 / 1024:.1f}MB, 使用率: {memory_usage.get('percent', 0):.1f}%"
                self.memory_info_label.config(text=memory_info)
            
            # 获取性能摘要
            perf_summary = self.memory_manager.get_performance_summary()
            if perf_summary:
                cpu_info = f"CPU使用率: {perf_summary.get('cpu_percent', 0):.1f}%"
                self.cpu_info_label.config(text=cpu_info)
                
                cache_info = f"缓存大小: {perf_summary.get('cache_size_mb', 0):.1f}MB, 缓存项: {perf_summary.get('cache_items', 0)}"
                self.cache_info_label.config(text=cache_info)
                
                stats_info = f"运行时间: {perf_summary.get('uptime_seconds', 0):.0f}秒"
                self.stats_info_label.config(text=stats_info)
            
        except Exception as e:
            print(f"更新性能状态失败: {e}")
    
    def _update_config_state(self):
        """更新配置状态"""
        try:
            # 导出设置
            export_dir = self.config_manager.get_export_directory()
            map_dir = self.config_manager.get_map_export_directory()
            export_info = f"导出目录: {export_dir}, 地图目录: {map_dir}"
            self.export_info_label.config(text=export_info)
            
            # 图像设置
            max_zoom = self.config_manager.get_max_zoom()
            min_zoom = self.config_manager.get_min_zoom()
            image_info = f"最大缩放: {max_zoom}x, 最小缩放: {min_zoom}x"
            self.image_info_label.config(text=image_info)
            
            # 性能设置
            max_cache = self.config_manager.get_max_cache_size()
            perf_info = f"最大缓存: {max_cache / 1024 / 1024:.0f}MB"
            self.perf_info_label.config(text=perf_info)
            
            # UI设置
            window_size = self.config_manager.get_window_size()
            ui_info = f"窗口大小: {window_size[0]}x{window_size[1]}"
            self.ui_info_label.config(text=ui_info)
            
        except Exception as e:
            print(f"更新配置状态失败: {e}")
    
    def _update_plugins_state(self):
        """更新插件状态"""
        try:
            # 清空现有项目
            for item in self.plugins_tree.get_children():
                self.plugins_tree.delete(item)
            
            # 获取插件信息
            if self.plugin_manager:
                all_plugins = self.plugin_manager.get_all_plugins()
                
                for plugin_name, plugin in all_plugins.items():
                    info = plugin.get_info()
                    enabled = "启用" if plugin.enabled else "禁用"
                    
                    self.plugins_tree.insert("", "end", text=info['name'],
                                           values=(info['version'], info['author'], enabled))
            else:
                # 如果没有插件管理器，显示默认信息
                self.plugins_tree.insert("", "end", text="无插件管理器",
                                       values=("", "", "未知"))
            
        except Exception as e:
            print(f"更新插件状态失败: {e}")
    
    def show(self):
        """显示状态窗口"""
        if self.window:
            self.window.deiconify()
            self.window.lift()
    
    def hide(self):
        """隐藏状态窗口"""
        if self.window:
            self.window.withdraw()
    
    def toggle(self):
        """切换状态窗口显示"""
        if self.window and self.window.state() == 'withdrawn':
            self.show()
        else:
            self.hide()
    
    def destroy(self):
        """销毁状态窗口"""
        self.stop_update_thread()
        if self.window:
            self.window.destroy()
            self.window = None 