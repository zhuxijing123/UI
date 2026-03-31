# src/views/settings_view.py - 设置窗口
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Dict, Any


class SettingsView:
    """设置窗口"""
    
    def __init__(self, root, config_manager, state_manager):
        self.root = root
        self.config_manager = config_manager
        self.state_manager = state_manager
        
        self.window = None
        self.config_vars = {}
        
        # 创建设置窗口
        self.create_window()
    
    def create_window(self):
        """创建设置窗口"""
        self.window = tk.Toplevel(self.root)
        self.window.title("设置")
        self.window.geometry("700x600")
        self.window.protocol("WM_DELETE_WINDOW", self.hide)
        
        # 创建主框架
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 创建选项卡
        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        # 导出设置选项卡
        self.create_export_tab(notebook)
        
        # 图像设置选项卡
        self.create_image_tab(notebook)
        
        # 性能设置选项卡
        self.create_performance_tab(notebook)
        
        # UI设置选项卡
        self.create_ui_tab(notebook)
        
        # 插件设置选项卡
        self.create_plugins_tab(notebook)
        
        # 地图设置选项卡
        self.create_map_tab(notebook)
        
        # 按钮框架
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Button(button_frame, text="保存设置", command=self.save_settings).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="重置设置", command=self.reset_settings).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="导入设置", command=self.import_settings).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="导出设置", command=self.export_settings).pack(side=tk.LEFT)
    
    def create_map_tab(self, notebook):
        """创建地图设置选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="地图设置")
        
        # 地图标记颜色设置
        marker_frame = ttk.LabelFrame(frame, text="标记颜色")
        marker_frame.pack(fill=tk.X, pady=5)
        
        # 获取当前颜色设置
        current_colors = self.config_manager.get_map_marker_colors()
        
        # 可通行标记颜色
        walkable_frame = ttk.Frame(marker_frame)
        walkable_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(walkable_frame, text="可通行标记:").pack(side=tk.LEFT)
        
        self.config_vars['map.marker_colors.walkable'] = tk.StringVar(value=current_colors.get('walkable', '#00FF00'))
        walkable_entry = ttk.Entry(walkable_frame, textvariable=self.config_vars['map.marker_colors.walkable'])
        walkable_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        # 创建颜色预览按钮
        walkable_preview = tk.Frame(walkable_frame, width=30, height=20, bg=current_colors.get('walkable', '#00FF00'))
        walkable_preview.pack(side=tk.RIGHT, padx=(0, 5))
        
        # 不可通行标记颜色
        blocked_frame = ttk.Frame(marker_frame)
        blocked_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(blocked_frame, text="不可通行标记:").pack(side=tk.LEFT)
        
        self.config_vars['map.marker_colors.blocked'] = tk.StringVar(value=current_colors.get('blocked', '#FF0000'))
        blocked_entry = ttk.Entry(blocked_frame, textvariable=self.config_vars['map.marker_colors.blocked'])
        blocked_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        blocked_preview = tk.Frame(blocked_frame, width=30, height=20, bg=current_colors.get('blocked', '#FF0000'))
        blocked_preview.pack(side=tk.RIGHT, padx=(0, 5))
        
        # 遮罩标记颜色
        masked_frame = ttk.Frame(marker_frame)
        masked_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(masked_frame, text="遮罩标记:").pack(side=tk.LEFT)
        
        self.config_vars['map.marker_colors.masked'] = tk.StringVar(value=current_colors.get('masked', '#0000FF'))
        masked_entry = ttk.Entry(masked_frame, textvariable=self.config_vars['map.marker_colors.masked'])
        masked_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        masked_preview = tk.Frame(masked_frame, width=30, height=20, bg=current_colors.get('masked', '#0000FF'))
        masked_preview.pack(side=tk.RIGHT, padx=(0, 5))
        
        # 标记透明度
        alpha_frame = ttk.Frame(marker_frame)
        alpha_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(alpha_frame, text="标记透明度:").pack(side=tk.LEFT)
        
        current_alpha = self.config_manager.get_map_marker_alpha()
        self.config_vars['map.marker_alpha'] = tk.DoubleVar(value=current_alpha)
        alpha_scale = ttk.Scale(alpha_frame, from_=0.1, to=1.0, variable=self.config_vars['map.marker_alpha'], orient=tk.HORIZONTAL)
        alpha_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        alpha_label = ttk.Label(alpha_frame, text=f"{current_alpha:.1f}")
        alpha_label.pack(side=tk.RIGHT)
        
        # 绑定透明度滑块变化事件
        def update_alpha_label(value):
            alpha_label.config(text=f"{float(value):.1f}")
        
        alpha_scale.config(command=update_alpha_label)
    
    def create_export_tab(self, notebook):
        """创建导出设置选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="导出设置")
        
        # 导出目录
        export_frame = ttk.LabelFrame(frame, text="导出目录")
        export_frame.pack(fill=tk.X, pady=5)
        
        export_dir_frame = ttk.Frame(export_frame)
        export_dir_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(export_dir_frame, text="导出目录:").pack(side=tk.LEFT)
        
        self.config_vars['export.directory'] = tk.StringVar(value=self.config_manager.get_export_directory())
        export_entry = ttk.Entry(export_dir_frame, textvariable=self.config_vars['export.directory'])
        export_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        ttk.Button(export_dir_frame, text="浏览", command=self.browse_export_directory).pack(side=tk.RIGHT)
        
        # 地图导出目录
        map_dir_frame = ttk.Frame(export_frame)
        map_dir_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(map_dir_frame, text="地图目录:").pack(side=tk.LEFT)
        
        self.config_vars['export.map_directory'] = tk.StringVar(value=self.config_manager.get_map_export_directory())
        map_entry = ttk.Entry(map_dir_frame, textvariable=self.config_vars['export.map_directory'])
        map_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        ttk.Button(map_dir_frame, text="浏览", command=self.browse_map_directory).pack(side=tk.RIGHT)
        
        # 默认素材类型
        default_type_frame = ttk.Frame(export_frame)
        default_type_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(default_type_frame, text="默认素材类型:").pack(side=tk.LEFT)
        
        self.config_vars['export.default_sprite_type'] = tk.StringVar(value=self.config_manager.get_default_sprite_type())
        type_combo = ttk.Combobox(default_type_frame, textvariable=self.config_vars['export.default_sprite_type'],
                                 values=['human', 'monster', 'npc', 'item', 'skill', 'effect', 'map'])
        type_combo.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))
    
    def create_image_tab(self, notebook):
        """创建图像设置选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="图像设置")
        
        # 缩放设置
        zoom_frame = ttk.LabelFrame(frame, text="缩放设置")
        zoom_frame.pack(fill=tk.X, pady=5)
        
        # 最大缩放
        max_zoom_frame = ttk.Frame(zoom_frame)
        max_zoom_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(max_zoom_frame, text="最大缩放:").pack(side=tk.LEFT)
        
        self.config_vars['image.max_zoom'] = tk.DoubleVar(value=self.config_manager.get_max_zoom())
        max_zoom_scale = ttk.Scale(max_zoom_frame, from_=1.0, to=10.0, variable=self.config_vars['image.max_zoom'])
        max_zoom_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        ttk.Label(max_zoom_frame, textvariable=tk.StringVar(value="5.0x")).pack(side=tk.RIGHT)
        
        # 最小缩放
        min_zoom_frame = ttk.Frame(zoom_frame)
        min_zoom_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(min_zoom_frame, text="最小缩放:").pack(side=tk.LEFT)
        
        self.config_vars['image.min_zoom'] = tk.DoubleVar(value=self.config_manager.get_min_zoom())
        min_zoom_scale = ttk.Scale(min_zoom_frame, from_=0.1, to=1.0, variable=self.config_vars['image.min_zoom'])
        min_zoom_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        ttk.Label(min_zoom_frame, textvariable=tk.StringVar(value="0.1x")).pack(side=tk.RIGHT)
        
        # 图像质量设置
        quality_frame = ttk.LabelFrame(frame, text="图像质量")
        quality_frame.pack(fill=tk.X, pady=5)
        
        # 图像质量
        quality_scale_frame = ttk.Frame(quality_frame)
        quality_scale_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(quality_scale_frame, text="图像质量:").pack(side=tk.LEFT)
        
        self.config_vars['image.quality'] = tk.IntVar(value=self.config_manager.get('image.quality', 95))
        quality_scale = ttk.Scale(quality_scale_frame, from_=50, to=100, variable=self.config_vars['image.quality'])
        quality_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        ttk.Label(quality_scale_frame, textvariable=tk.StringVar(value="95%")).pack(side=tk.RIGHT)
        
        # 最大图像尺寸
        max_size_frame = ttk.Frame(quality_frame)
        max_size_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(max_size_frame, text="最大图像尺寸:").pack(side=tk.LEFT)
        
        self.config_vars['image.max_size'] = tk.IntVar(value=self.config_manager.get('image.max_size', 4096))
        max_size_combo = ttk.Combobox(max_size_frame, textvariable=self.config_vars['image.max_size'],
                                     values=[1024, 2048, 4096, 8192, 16384])
        max_size_combo.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))
    
    def create_performance_tab(self, notebook):
        """创建性能设置选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="性能设置")
        
        # 缓存设置
        cache_frame = ttk.LabelFrame(frame, text="缓存设置")
        cache_frame.pack(fill=tk.X, pady=5)
        
        # 最大缓存大小
        cache_size_frame = ttk.Frame(cache_frame)
        cache_size_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(cache_size_frame, text="最大缓存大小:").pack(side=tk.LEFT)
        
        self.config_vars['performance.max_cache_size'] = tk.IntVar(value=self.config_manager.get_max_cache_size() // (1024*1024))
        cache_size_combo = ttk.Combobox(cache_size_frame, textvariable=self.config_vars['performance.max_cache_size'],
                                       values=[50, 100, 200, 500, 1000, 2000])
        cache_size_combo.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        ttk.Label(cache_size_frame, text="MB").pack(side=tk.RIGHT)
        
        # 缓存清理间隔
        cleanup_frame = ttk.Frame(cache_frame)
        cleanup_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(cleanup_frame, text="缓存清理间隔:").pack(side=tk.LEFT)
        
        self.config_vars['performance.cache_cleanup_interval'] = tk.IntVar(value=self.config_manager.get('performance.cache_cleanup_interval', 300))
        cleanup_combo = ttk.Combobox(cleanup_frame, textvariable=self.config_vars['performance.cache_cleanup_interval'],
                                    values=[60, 300, 600, 1800, 3600])
        cleanup_combo.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        ttk.Label(cleanup_frame, text="秒").pack(side=tk.RIGHT)
        
        # 性能监控设置
        monitor_frame = ttk.LabelFrame(frame, text="性能监控")
        monitor_frame.pack(fill=tk.X, pady=5)
        
        # 启用性能监控
        self.config_vars['performance.enable_monitoring'] = tk.BooleanVar(value=self.config_manager.get('performance.enable_monitoring', True))
        ttk.Checkbutton(monitor_frame, text="启用性能监控", variable=self.config_vars['performance.enable_monitoring']).pack(anchor=tk.W, padx=5, pady=2)
        
        # 启用渐进式加载
        self.config_vars['performance.enable_progressive_loading'] = tk.BooleanVar(value=self.config_manager.get('performance.enable_progressive_loading', True))
        ttk.Checkbutton(monitor_frame, text="启用渐进式加载", variable=self.config_vars['performance.enable_progressive_loading']).pack(anchor=tk.W, padx=5, pady=2)
    
    def create_ui_tab(self, notebook):
        """创建UI设置选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="UI设置")
        
        # 窗口设置
        window_frame = ttk.LabelFrame(frame, text="窗口设置")
        window_frame.pack(fill=tk.X, pady=5)
        
        # 窗口宽度
        width_frame = ttk.Frame(window_frame)
        width_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(width_frame, text="窗口宽度:").pack(side=tk.LEFT)
        
        window_size = self.config_manager.get_window_size()
        self.config_vars['ui.window_width'] = tk.IntVar(value=window_size[0])
        width_entry = ttk.Entry(width_frame, textvariable=self.config_vars['ui.window_width'])
        width_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))
        
        # 窗口高度
        height_frame = ttk.Frame(window_frame)
        height_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(height_frame, text="窗口高度:").pack(side=tk.LEFT)
        
        self.config_vars['ui.window_height'] = tk.IntVar(value=window_size[1])
        height_entry = ttk.Entry(height_frame, textvariable=self.config_vars['ui.window_height'])
        height_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))
        
        # 主题设置
        theme_frame = ttk.LabelFrame(frame, text="主题设置")
        theme_frame.pack(fill=tk.X, pady=5)
        
        # 主题选择
        theme_select_frame = ttk.Frame(theme_frame)
        theme_select_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(theme_select_frame, text="主题:").pack(side=tk.LEFT)
        
        self.config_vars['ui.theme'] = tk.StringVar(value=self.config_manager.get('ui.theme', 'default'))
        theme_combo = ttk.Combobox(theme_select_frame, textvariable=self.config_vars['ui.theme'],
                                  values=['default', 'clam', 'alt', 'classic'])
        theme_combo.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))
    
    def create_plugins_tab(self, notebook):
        """创建插件设置选项卡"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="插件设置")
        
        # 插件目录
        plugin_dir_frame = ttk.LabelFrame(frame, text="插件目录")
        plugin_dir_frame.pack(fill=tk.X, pady=5)
        
        dir_frame = ttk.Frame(plugin_dir_frame)
        dir_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(dir_frame, text="插件目录:").pack(side=tk.LEFT)
        
        self.config_vars['plugins.plugin_directory'] = tk.StringVar(value=self.config_manager.get('plugins.plugin_directory', 'plugins'))
        dir_entry = ttk.Entry(dir_frame, textvariable=self.config_vars['plugins.plugin_directory'])
        dir_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        
        ttk.Button(dir_frame, text="浏览", command=self.browse_plugin_directory).pack(side=tk.RIGHT)
        
        # 插件设置
        plugin_settings_frame = ttk.LabelFrame(frame, text="插件设置")
        plugin_settings_frame.pack(fill=tk.X, pady=5)
        
        # 自动加载插件
        self.config_vars['plugins.auto_load_plugins'] = tk.BooleanVar(value=self.config_manager.get('plugins.auto_load_plugins', True))
        ttk.Checkbutton(plugin_settings_frame, text="自动加载插件", variable=self.config_vars['plugins.auto_load_plugins']).pack(anchor=tk.W, padx=5, pady=2)
        
        # 启用插件热重载
        self.config_vars['plugins.enable_hot_reload'] = tk.BooleanVar(value=self.config_manager.get('plugins.enable_hot_reload', False))
        ttk.Checkbutton(plugin_settings_frame, text="启用插件热重载", variable=self.config_vars['plugins.enable_hot_reload']).pack(anchor=tk.W, padx=5, pady=2)
    
    def browse_export_directory(self):
        """浏览导出目录"""
        directory = filedialog.askdirectory(title="选择导出目录")
        if directory:
            self.config_vars['export.directory'].set(directory)
    
    def browse_map_directory(self):
        """浏览地图目录"""
        directory = filedialog.askdirectory(title="选择地图导出目录")
        if directory:
            self.config_vars['export.map_directory'].set(directory)
    
    def browse_plugin_directory(self):
        """浏览插件目录"""
        directory = filedialog.askdirectory(title="选择插件目录")
        if directory:
            self.config_vars['plugins.plugin_directory'].set(directory)
    
    def save_settings(self):
        """保存设置"""
        try:
            # 更新配置
            for key, var in self.config_vars.items():
                self.config_manager.set(key, var.get())
            
            # 特殊处理地图标记颜色
            if 'map.marker_colors.walkable' in self.config_vars:
                colors = {
                    'walkable': self.config_vars['map.marker_colors.walkable'].get(),
                    'blocked': self.config_vars['map.marker_colors.blocked'].get(),
                    'masked': self.config_vars['map.marker_colors.masked'].get()
                }
                self.config_manager.set_map_marker_colors(colors)
            
            # 保存配置
            self.config_manager.save_config()
            
            messagebox.showinfo("成功", "设置已保存")
            
        except Exception as e:
            messagebox.showerror("错误", f"保存设置失败: {e}")
    
    def reset_settings(self):
        """重置设置"""
        if messagebox.askyesno("确认", "确定要重置所有设置吗？"):
            try:
                self.config_manager.reset_config()
                self.load_settings()
                messagebox.showinfo("成功", "设置已重置")
            except Exception as e:
                messagebox.showerror("错误", f"重置设置失败: {e}")
    
    def import_settings(self):
        """导入设置"""
        file_path = filedialog.askopenfilename(
            title="选择配置文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                self.config_manager.load_config(file_path)
                self.load_settings()
                messagebox.showinfo("成功", "设置已导入")
            except Exception as e:
                messagebox.showerror("错误", f"导入设置失败: {e}")
    
    def export_settings(self):
        """导出设置"""
        file_path = filedialog.asksaveasfilename(
            title="保存配置文件",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                self.config_manager.save_config(file_path)
                messagebox.showinfo("成功", f"设置已导出到: {file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"导出设置失败: {e}")
    
    def load_settings(self):
        """加载设置到界面"""
        try:
            # 更新界面变量
            for key, var in self.config_vars.items():
                value = self.config_manager.get(key)
                if value is not None:
                    var.set(value)
        except Exception as e:
            print(f"加载设置失败: {e}")
    
    def show(self):
        """显示设置窗口"""
        if self.window:
            self.window.deiconify()
            self.window.lift()
            self.load_settings()
    
    def hide(self):
        """隐藏设置窗口"""
        if self.window:
            self.window.withdraw()
    
    def toggle(self):
        """切换设置窗口显示"""
        if self.window and self.window.state() == 'withdrawn':
            self.show()
        else:
            self.hide()
    
    def destroy(self):
        """销毁设置窗口"""
        if self.window:
            self.window.destroy()
            self.window = None 