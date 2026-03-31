# plugins/image_processor_plugin.py - 图像处理插件
import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageEnhance, ImageTk
import os
import sys

# 添加src目录到路径，以便导入插件基类
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
from utils.plugin_manager import PluginBase


class ImageProcessorPlugin(PluginBase):
    """图像处理插件 - 提供亮度、对比度、饱和度等调整功能"""
    
    def __init__(self, plugin_manager, config_manager):
        super().__init__(plugin_manager, config_manager)
        self.plugin_id = "image_processor"
        self.name = "图像处理器"
        self.version = "1.0.0"
        self.description = "图像处理插件，提供亮度、对比度、饱和度等调整功能"
        self.author = "Sprite Viewer Team"
        
        # 插件UI组件
        self.window = None
        self.image_label = None
        self.original_image = None
        self.current_image = None
        
        # 调整参数
        self.brightness_var = tk.DoubleVar(value=1.0)
        self.contrast_var = tk.DoubleVar(value=1.0)
        self.saturation_var = tk.DoubleVar(value=1.0)
        self.sharpness_var = tk.DoubleVar(value=1.0)
    
    def initialize(self) -> bool:
        """初始化插件"""
        try:
            print(f"初始化插件: {self.name}")
            return True
        except Exception as e:
            print(f"插件初始化失败: {e}")
            return False
    
    def execute(self, *args, **kwargs) -> any:
        """执行插件功能"""
        try:
            # 打开图像处理窗口
            self.show_processor_window()
            return True
        except Exception as e:
            print(f"执行插件失败: {e}")
            return False
    
    def show_processor_window(self):
        """显示图像处理器窗口"""
        if self.window is None or not self.window.winfo_exists():
            self.create_processor_window()
        else:
            self.window.deiconify()
            self.window.lift()
    
    def create_processor_window(self):
        """创建图像处理器窗口"""
        self.window = tk.Toplevel()
        self.window.title(f"图像处理器 - {self.name}")
        self.window.geometry("800x600")
        self.window.protocol("WM_DELETE_WINDOW", self.window.withdraw)
        
        # 创建主框架
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 创建左右分栏
        left_frame = ttk.Frame(main_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        right_frame = ttk.Frame(main_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 左侧：图像显示区域
        self.setup_image_display(left_frame)
        
        # 右侧：控制面板
        self.setup_control_panel(right_frame)
    
    def setup_image_display(self, parent):
        """设置图像显示区域"""
        # 图像显示标签
        self.image_label = ttk.Label(parent, text="请选择图像文件")
        self.image_label.pack(fill=tk.BOTH, expand=True)
        
        # 按钮框架
        btn_frame = ttk.Frame(parent)
        btn_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Button(btn_frame, text="打开图像", command=self.open_image).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(btn_frame, text="保存图像", command=self.save_image).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(btn_frame, text="重置调整", command=self.reset_adjustments).pack(side=tk.LEFT)
    
    def setup_control_panel(self, parent):
        """设置控制面板"""
        # 亮度调整
        brightness_frame = ttk.LabelFrame(parent, text="亮度调整")
        brightness_frame.pack(fill=tk.X, pady=(0, 10))
        
        brightness_scale = ttk.Scale(
            brightness_frame,
            from_=0.0,
            to=2.0,
            variable=self.brightness_var,
            orient=tk.HORIZONTAL,
            command=self.on_brightness_change
        )
        brightness_scale.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(brightness_frame, textvariable=tk.StringVar(value="1.0")).pack()
        
        # 对比度调整
        contrast_frame = ttk.LabelFrame(parent, text="对比度调整")
        contrast_frame.pack(fill=tk.X, pady=(0, 10))
        
        contrast_scale = ttk.Scale(
            contrast_frame,
            from_=0.0,
            to=2.0,
            variable=self.contrast_var,
            orient=tk.HORIZONTAL,
            command=self.on_contrast_change
        )
        contrast_scale.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(contrast_frame, textvariable=tk.StringVar(value="1.0")).pack()
        
        # 饱和度调整
        saturation_frame = ttk.LabelFrame(parent, text="饱和度调整")
        saturation_frame.pack(fill=tk.X, pady=(0, 10))
        
        saturation_scale = ttk.Scale(
            saturation_frame,
            from_=0.0,
            to=2.0,
            variable=self.saturation_var,
            orient=tk.HORIZONTAL,
            command=self.on_saturation_change
        )
        saturation_scale.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(saturation_frame, textvariable=tk.StringVar(value="1.0")).pack()
        
        # 锐度调整
        sharpness_frame = ttk.LabelFrame(parent, text="锐度调整")
        sharpness_frame.pack(fill=tk.X, pady=(0, 10))
        
        sharpness_scale = ttk.Scale(
            sharpness_frame,
            from_=0.0,
            to=2.0,
            variable=self.sharpness_var,
            orient=tk.HORIZONTAL,
            command=self.on_sharpness_change
        )
        sharpness_scale.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(sharpness_frame, textvariable=tk.StringVar(value="1.0")).pack()
        
        # 预设按钮
        preset_frame = ttk.LabelFrame(parent, text="预设效果")
        preset_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(preset_frame, text="增强", command=self.apply_enhance_preset).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(preset_frame, text="柔和", command=self.apply_soft_preset).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(preset_frame, text="黑白", command=self.apply_bw_preset).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(preset_frame, text="复古", command=self.apply_vintage_preset).pack(fill=tk.X, padx=5, pady=2)
    
    def open_image(self):
        """打开图像文件"""
        from tkinter import filedialog
        
        file_path = filedialog.askopenfilename(
            title="选择图像文件",
            filetypes=[
                ("图像文件", "*.png *.jpg *.jpeg *.bmp *.gif"),
                ("所有文件", "*.*")
            ]
        )
        
        if file_path:
            try:
                self.original_image = Image.open(file_path)
                self.current_image = self.original_image.copy()
                self.update_image_display()
                print(f"图像加载成功: {file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"无法加载图像: {e}")
    
    def update_image_display(self):
        """更新图像显示"""
        if self.current_image:
            # 调整图像大小以适应显示区域
            display_size = (400, 300)
            display_image = self.current_image.copy()
            display_image.thumbnail(display_size, Image.LANCZOS)
            
            # 转换为PhotoImage
            photo = ImageTk.PhotoImage(display_image)
            
            # 更新标签
            self.image_label.configure(image=photo, text="")
            self.image_label.image = photo  # 保持引用
    
    def apply_adjustments(self):
        """应用所有调整"""
        if self.original_image is None:
            return
        
        self.current_image = self.original_image.copy()
        
        # 应用亮度调整
        if self.brightness_var.get() != 1.0:
            enhancer = ImageEnhance.Brightness(self.current_image)
            self.current_image = enhancer.enhance(self.brightness_var.get())
        
        # 应用对比度调整
        if self.contrast_var.get() != 1.0:
            enhancer = ImageEnhance.Contrast(self.current_image)
            self.current_image = enhancer.enhance(self.contrast_var.get())
        
        # 应用饱和度调整
        if self.saturation_var.get() != 1.0:
            enhancer = ImageEnhance.Color(self.current_image)
            self.current_image = enhancer.enhance(self.saturation_var.get())
        
        # 应用锐度调整
        if self.sharpness_var.get() != 1.0:
            enhancer = ImageEnhance.Sharpness(self.current_image)
            self.current_image = enhancer.enhance(self.sharpness_var.get())
        
        self.update_image_display()
    
    def on_brightness_change(self, value):
        """亮度调整回调"""
        self.apply_adjustments()
    
    def on_contrast_change(self, value):
        """对比度调整回调"""
        self.apply_adjustments()
    
    def on_saturation_change(self, value):
        """饱和度调整回调"""
        self.apply_adjustments()
    
    def on_sharpness_change(self, value):
        """锐度调整回调"""
        self.apply_adjustments()
    
    def reset_adjustments(self):
        """重置所有调整"""
        self.brightness_var.set(1.0)
        self.contrast_var.set(1.0)
        self.saturation_var.set(1.0)
        self.sharpness_var.set(1.0)
        
        if self.original_image:
            self.current_image = self.original_image.copy()
            self.update_image_display()
    
    def apply_enhance_preset(self):
        """应用增强预设"""
        self.brightness_var.set(1.1)
        self.contrast_var.set(1.2)
        self.saturation_var.set(1.1)
        self.sharpness_var.set(1.1)
        self.apply_adjustments()
    
    def apply_soft_preset(self):
        """应用柔和预设"""
        self.brightness_var.set(1.05)
        self.contrast_var.set(0.9)
        self.saturation_var.set(0.8)
        self.sharpness_var.set(0.8)
        self.apply_adjustments()
    
    def apply_bw_preset(self):
        """应用黑白预设"""
        self.brightness_var.set(1.0)
        self.contrast_var.set(1.3)
        self.saturation_var.set(0.0)
        self.sharpness_var.set(1.2)
        self.apply_adjustments()
    
    def apply_vintage_preset(self):
        """应用复古预设"""
        self.brightness_var.set(0.9)
        self.contrast_var.set(1.1)
        self.saturation_var.set(0.7)
        self.sharpness_var.set(0.9)
        self.apply_adjustments()
    
    def save_image(self):
        """保存处理后的图像"""
        if self.current_image is None:
            messagebox.showwarning("警告", "没有图像可保存")
            return
        
        from tkinter import filedialog
        
        file_path = filedialog.asksaveasfilename(
            title="保存图像",
            defaultextension=".png",
            filetypes=[
                ("PNG文件", "*.png"),
                ("JPEG文件", "*.jpg"),
                ("所有文件", "*.*")
            ]
        )
        
        if file_path:
            try:
                self.current_image.save(file_path)
                messagebox.showinfo("成功", f"图像已保存到: {file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"保存图像失败: {e}")
    
    def cleanup(self):
        """清理插件资源"""
        if self.window and self.window.winfo_exists():
            self.window.destroy()
        self.window = None
        self.image_label = None
        self.original_image = None
        self.current_image = None 