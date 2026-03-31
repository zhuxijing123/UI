# plugins/image_editor_plugin.py - 图片编辑器插件
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, colorchooser
from PIL import Image, ImageTk, ImageEnhance, ImageFilter, ImageOps, ImageDraw, ImageChops
import os
import sys
import numpy as np
from typing import List, Dict, Tuple, Optional
import json

# 添加src目录到路径，以便导入插件基类
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
from utils.plugin_manager import PluginBase


class Layer:
    """图层类"""
    def __init__(self, name: str, image: Image.Image, visible: bool = True, opacity: float = 1.0):
        self.name = name
        self.original_image = image.copy()
        self.current_image = image.copy()
        self.visible = visible
        self.opacity = opacity
        self.blend_mode = "normal"  # normal, multiply, screen, overlay, etc.
        self.position = (0, 0)
        self.scale = (1.0, 1.0)
        self.rotation = 0.0


class ImageEditorPlugin(PluginBase):
    """图片编辑器插件 - 功能类似PS和美图秀秀"""
    
    def __init__(self, plugin_manager, config_manager):
        super().__init__(plugin_manager, config_manager)
        self.plugin_id = "image_editor"
        self.name = "图片编辑器"
        self.version = "1.0.0"
        self.description = "强大的图片编辑器，支持图层、滤镜、调整、抠图等功能"
        self.author = "Sprite Viewer Team"
        
        # 编辑器窗口
        self.window = None
        self.canvas = None
        self.toolbar = None
        self.layer_panel = None
        self.property_panel = None
        
        # 图层管理
        self.layers: List[Layer] = []
        self.active_layer_index = -1
        self.background_layer = None
        
        # 工具状态
        self.current_tool = "select"  # select, brush, eraser, crop, magic_wand
        self.brush_size = 10
        self.brush_color = (255, 0, 0)
        self.eraser_size = 10
        
        # 历史记录
        self.history: List[Dict] = []
        self.history_index = -1
        self.max_history = 50
        
        # 选择区域
        self.selection = None
        self.selection_start = None
        self.selection_end = None
        
        # 画布状态
        self.canvas_width = 800
        self.canvas_height = 600
        self.zoom_level = 1.0
        self.pan_offset = (0, 0)
        
        # 滤镜预设
        self.filter_presets = {
            "vintage": {"brightness": 1.1, "contrast": 1.2, "saturation": 0.8, "sepia": True},
            "black_white": {"brightness": 1.0, "contrast": 1.3, "saturation": 0.0},
            "warm": {"brightness": 1.1, "contrast": 1.1, "saturation": 1.2, "temperature": 1.2},
            "cool": {"brightness": 1.0, "contrast": 1.1, "saturation": 0.9, "temperature": 0.8},
            "dramatic": {"brightness": 0.9, "contrast": 1.5, "saturation": 1.1}
        }
    
    def initialize(self) -> bool:
        """初始化插件"""
        try:
            print(f"初始化图片编辑器插件: {self.name}")
            return True
        except Exception as e:
            print(f"图片编辑器插件初始化失败: {e}")
            return False
    
    def execute(self, *args, **kwargs) -> any:
        """执行插件功能"""
        try:
            # 打开图片编辑器窗口
            self.show_editor_window()
            return True
        except Exception as e:
            print(f"执行图片编辑器插件失败: {e}")
            return False
    
    def show_editor_window(self):
        """显示图片编辑器窗口"""
        if self.window is None or not self.window.winfo_exists():
            self.create_editor_window()
        else:
            self.window.deiconify()
            self.window.lift()
    
    def create_editor_window(self):
        """创建图片编辑器窗口"""
        self.window = tk.Toplevel()
        self.window.title(f"图片编辑器 - {self.name}")
        self.window.geometry("1400x900")
        self.window.protocol("WM_DELETE_WINDOW", self.window.withdraw)
        
        # 创建主菜单
        self.create_menu()
        
        # 创建主框架
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 创建工具栏
        self.create_toolbar(main_frame)
        
        # 创建主工作区
        workspace_frame = ttk.Frame(main_frame)
        workspace_frame.pack(fill=tk.BOTH, expand=True)
        
        # 左侧：图层面板
        self.create_layer_panel(workspace_frame)
        
        # 中间：画布区域
        self.create_canvas_area(workspace_frame)
        
        # 右侧：属性面板
        self.create_property_panel(workspace_frame)
        
        # 创建状态栏
        self.create_status_bar(main_frame)
        
        # 初始化画布
        self.initialize_canvas()
    
    def create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.window)
        self.window.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="新建", command=self.new_project)
        file_menu.add_command(label="打开", command=self.open_image)
        file_menu.add_separator()
        file_menu.add_command(label="保存", command=self.save_image)
        file_menu.add_command(label="另存为", command=self.save_as_image)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.window.withdraw)
        
        # 编辑菜单
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="编辑", menu=edit_menu)
        edit_menu.add_command(label="撤销", command=self.undo)
        edit_menu.add_command(label="重做", command=self.redo)
        edit_menu.add_separator()
        edit_menu.add_command(label="复制", command=self.copy_selection)
        edit_menu.add_command(label="粘贴", command=self.paste_image)
        edit_menu.add_separator()
        edit_menu.add_command(label="全选", command=self.select_all)
        edit_menu.add_command(label="清除选择", command=self.clear_selection)
        
        # 图层菜单
        layer_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="图层", menu=layer_menu)
        layer_menu.add_command(label="新建图层", command=self.add_layer)
        layer_menu.add_command(label="删除图层", command=self.delete_layer)
        layer_menu.add_separator()
        layer_menu.add_command(label="合并图层", command=self.merge_layers)
        layer_menu.add_command(label="复制图层", command=self.duplicate_layer)
        
        # 滤镜菜单
        filter_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="滤镜", menu=filter_menu)
        filter_menu.add_command(label="模糊", command=lambda: self.apply_filter("blur"))
        filter_menu.add_command(label="锐化", command=lambda: self.apply_filter("sharpen"))
        filter_menu.add_separator()
        filter_menu.add_command(label="黑白", command=lambda: self.apply_preset("black_white"))
        filter_menu.add_command(label="复古", command=lambda: self.apply_preset("vintage"))
        filter_menu.add_command(label="暖色", command=lambda: self.apply_preset("warm"))
        filter_menu.add_command(label="冷色", command=lambda: self.apply_preset("cool"))
        filter_menu.add_command(label="戏剧化", command=lambda: self.apply_preset("dramatic"))
        
        # 工具菜单
        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="工具", menu=tools_menu)
        tools_menu.add_command(label="选择工具", command=lambda: self.set_tool("select"))
        tools_menu.add_command(label="画笔工具", command=lambda: self.set_tool("brush"))
        tools_menu.add_command(label="橡皮擦", command=lambda: self.set_tool("eraser"))
        tools_menu.add_command(label="裁剪工具", command=lambda: self.set_tool("crop"))
        tools_menu.add_command(label="魔术棒", command=lambda: self.set_tool("magic_wand"))
    
    def create_toolbar(self, parent):
        """创建工具栏"""
        self.toolbar = ttk.Frame(parent)
        self.toolbar.pack(fill=tk.X, padx=5, pady=2)
        
        # 工具按钮
        tools_frame = ttk.LabelFrame(self.toolbar, text="工具")
        tools_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(tools_frame, text="选择", command=lambda: self.set_tool("select")).pack(side=tk.LEFT, padx=2)
        ttk.Button(tools_frame, text="画笔", command=lambda: self.set_tool("brush")).pack(side=tk.LEFT, padx=2)
        ttk.Button(tools_frame, text="橡皮擦", command=lambda: self.set_tool("eraser")).pack(side=tk.LEFT, padx=2)
        ttk.Button(tools_frame, text="裁剪", command=lambda: self.set_tool("crop")).pack(side=tk.LEFT, padx=2)
        ttk.Button(tools_frame, text="魔术棒", command=lambda: self.set_tool("magic_wand")).pack(side=tk.LEFT, padx=2)
        
        # 画笔设置
        brush_frame = ttk.LabelFrame(self.toolbar, text="画笔设置")
        brush_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Label(brush_frame, text="大小:").pack(side=tk.LEFT)
        self.brush_size_var = tk.IntVar(value=self.brush_size)
        brush_size_scale = ttk.Scale(brush_frame, from_=1, to=50, variable=self.brush_size_var, 
                                    orient=tk.HORIZONTAL, length=100)
        brush_size_scale.pack(side=tk.LEFT, padx=5)
        brush_size_scale.bind("<ButtonRelease-1>", self.on_brush_size_change)
        
        ttk.Button(brush_frame, text="颜色", command=self.choose_brush_color).pack(side=tk.LEFT, padx=5)
        
        # 图层操作
        layer_frame = ttk.LabelFrame(self.toolbar, text="图层")
        layer_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(layer_frame, text="新建", command=self.add_layer).pack(side=tk.LEFT, padx=2)
        ttk.Button(layer_frame, text="删除", command=self.delete_layer).pack(side=tk.LEFT, padx=2)
        ttk.Button(layer_frame, text="合并", command=self.merge_layers).pack(side=tk.LEFT, padx=2)
    
    def create_layer_panel(self, parent):
        """创建图层面板"""
        layer_frame = ttk.Frame(parent)
        layer_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=5)
        
        # 图层标题
        ttk.Label(layer_frame, text="图层", font=("Arial", 12, "bold")).pack(pady=5)
        
        # 图层列表
        self.layer_listbox = tk.Listbox(layer_frame, width=25, height=20)
        self.layer_listbox.pack(fill=tk.BOTH, expand=True)
        self.layer_listbox.bind("<<ListboxSelect>>", self.on_layer_select)
        
        # 图层操作按钮
        layer_btn_frame = ttk.Frame(layer_frame)
        layer_btn_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(layer_btn_frame, text="新建", command=self.add_layer).pack(side=tk.LEFT, padx=2)
        ttk.Button(layer_btn_frame, text="删除", command=self.delete_layer).pack(side=tk.LEFT, padx=2)
        ttk.Button(layer_btn_frame, text="复制", command=self.duplicate_layer).pack(side=tk.LEFT, padx=2)
    
    def create_canvas_area(self, parent):
        """创建画布区域"""
        canvas_frame = ttk.Frame(parent)
        canvas_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 画布容器
        canvas_container = ttk.Frame(canvas_frame)
        canvas_container.pack(fill=tk.BOTH, expand=True)
        
        # 创建画布
        self.canvas = tk.Canvas(canvas_container, bg="white", width=self.canvas_width, height=self.canvas_height)
        self.canvas.pack(fill=tk.BOTH, expand=True)
        
        # 绑定鼠标事件
        self.canvas.bind("<Button-1>", self.on_canvas_click)
        self.canvas.bind("<B1-Motion>", self.on_canvas_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_canvas_release)
        self.canvas.bind("<MouseWheel>", self.on_mouse_wheel)
        self.canvas.bind("<Motion>", self.on_canvas_motion)
    
    def create_property_panel(self, parent):
        """创建属性面板"""
        property_frame = ttk.Frame(parent)
        property_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=5, pady=5)
        
        # 属性标题
        ttk.Label(property_frame, text="属性", font=("Arial", 12, "bold")).pack(pady=5)
        
        # 图层属性
        layer_prop_frame = ttk.LabelFrame(property_frame, text="图层属性")
        layer_prop_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(layer_prop_frame, text="不透明度:").pack(anchor=tk.W)
        self.opacity_var = tk.DoubleVar(value=1.0)
        opacity_scale = ttk.Scale(layer_prop_frame, from_=0.0, to=1.0, variable=self.opacity_var,
                                 orient=tk.HORIZONTAL, length=150)
        opacity_scale.pack(fill=tk.X, padx=5, pady=2)
        opacity_scale.bind("<ButtonRelease-1>", self.on_opacity_change)
        
        # 混合模式
        ttk.Label(layer_prop_frame, text="混合模式:").pack(anchor=tk.W)
        self.blend_mode_var = tk.StringVar(value="normal")
        blend_combo = ttk.Combobox(layer_prop_frame, textvariable=self.blend_mode_var,
                                  values=["normal", "multiply", "screen", "overlay", "soft_light"],
                                  state="readonly", width=15)
        blend_combo.pack(fill=tk.X, padx=5, pady=2)
        blend_combo.bind("<<ComboboxSelected>>", self.on_blend_mode_change)
        
        # 滤镜属性
        filter_prop_frame = ttk.LabelFrame(property_frame, text="滤镜属性")
        filter_prop_frame.pack(fill=tk.X, pady=5)
        
        # 亮度
        ttk.Label(filter_prop_frame, text="亮度:").pack(anchor=tk.W)
        self.brightness_var = tk.DoubleVar(value=1.0)
        brightness_scale = ttk.Scale(filter_prop_frame, from_=0.0, to=2.0, variable=self.brightness_var,
                                   orient=tk.HORIZONTAL, length=150)
        brightness_scale.pack(fill=tk.X, padx=5, pady=2)
        brightness_scale.bind("<ButtonRelease-1>", self.on_brightness_change)
        
        # 对比度
        ttk.Label(filter_prop_frame, text="对比度:").pack(anchor=tk.W)
        self.contrast_var = tk.DoubleVar(value=1.0)
        contrast_scale = ttk.Scale(filter_prop_frame, from_=0.0, to=2.0, variable=self.contrast_var,
                                 orient=tk.HORIZONTAL, length=150)
        contrast_scale.pack(fill=tk.X, padx=5, pady=2)
        contrast_scale.bind("<ButtonRelease-1>", self.on_contrast_change)
        
        # 饱和度
        ttk.Label(filter_prop_frame, text="饱和度:").pack(anchor=tk.W)
        self.saturation_var = tk.DoubleVar(value=1.0)
        saturation_scale = ttk.Scale(filter_prop_frame, from_=0.0, to=2.0, variable=self.saturation_var,
                                   orient=tk.HORIZONTAL, length=150)
        saturation_scale.pack(fill=tk.X, padx=5, pady=2)
        saturation_scale.bind("<ButtonRelease-1>", self.on_saturation_change)
        
        # 预设滤镜按钮
        preset_frame = ttk.LabelFrame(property_frame, text="预设滤镜")
        preset_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(preset_frame, text="黑白", command=lambda: self.apply_preset("black_white")).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(preset_frame, text="复古", command=lambda: self.apply_preset("vintage")).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(preset_frame, text="暖色", command=lambda: self.apply_preset("warm")).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(preset_frame, text="冷色", command=lambda: self.apply_preset("cool")).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(preset_frame, text="戏剧化", command=lambda: self.apply_preset("dramatic")).pack(fill=tk.X, padx=5, pady=2)
    
    def create_status_bar(self, parent):
        """创建状态栏"""
        status_frame = ttk.Frame(parent)
        status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.status_label = ttk.Label(status_frame, text="就绪")
        self.status_label.pack(side=tk.LEFT, padx=5)
        
        self.coord_label = ttk.Label(status_frame, text="坐标: (0, 0)")
        self.coord_label.pack(side=tk.RIGHT, padx=5)
    
    def initialize_canvas(self):
        """初始化画布"""
        # 创建背景图层
        background_image = Image.new("RGBA", (self.canvas_width, self.canvas_height), (255, 255, 255, 255))
        background_layer = Layer("背景", background_image)
        self.layers.append(background_layer)
        self.active_layer_index = 0
        
        # 更新图层列表
        self.update_layer_list()
        
        # 渲染画布
        self.render_canvas()
    
    def update_layer_list(self):
        """更新图层列表"""
        self.layer_listbox.delete(0, tk.END)
        for i, layer in enumerate(reversed(self.layers)):
            visibility = "👁" if layer.visible else "👁‍🗨"
            self.layer_listbox.insert(0, f"{visibility} {layer.name}")
            if i == len(self.layers) - 1 - self.active_layer_index:
                self.layer_listbox.selection_set(0)
    
    def render_canvas(self):
        """渲染画布"""
        if not self.layers:
            return
        
        # 创建合成图像
        composite_image = Image.new("RGBA", (self.canvas_width, self.canvas_height), (0, 0, 0, 0))
        
        for layer in self.layers:
            if layer.visible:
                # 应用图层变换
                transformed_image = self.apply_layer_transforms(layer)
                
                # 应用混合模式
                composite_image = self.blend_layers(composite_image, transformed_image, layer)
        
        # 显示图像
        self.display_image(composite_image)
    
    def apply_layer_transforms(self, layer: Layer) -> Image.Image:
        """应用图层变换"""
        image = layer.current_image.copy()
        
        # 应用缩放
        if layer.scale != (1.0, 1.0):
            new_size = (int(image.width * layer.scale[0]), int(image.height * layer.scale[1]))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # 应用旋转
        if layer.rotation != 0:
            image = image.rotate(layer.rotation, expand=True, resample=Image.Resampling.BICUBIC)
        
        # 应用位置偏移
        if layer.position != (0, 0):
            new_image = Image.new("RGBA", image.size, (0, 0, 0, 0))
            new_image.paste(image, layer.position)
            image = new_image
        
        return image
    
    def blend_layers(self, base: Image.Image, top: Image.Image, layer: Layer) -> Image.Image:
        """混合图层"""
        if layer.blend_mode == "normal":
            return Image.alpha_composite(base, top)
        elif layer.blend_mode == "multiply":
            return ImageChops.multiply(base, top)
        elif layer.blend_mode == "screen":
            return ImageChops.screen(base, top)
        elif layer.blend_mode == "overlay":
            return self.overlay_blend(base, top)
        else:
            return Image.alpha_composite(base, top)
    
    def overlay_blend(self, base: Image.Image, top: Image.Image) -> Image.Image:
        """叠加混合模式"""
        # 简化的叠加混合实现
        base_array = np.array(base).astype(float)
        top_array = np.array(top).astype(float)
        
        # 叠加混合公式
        result = np.where(base_array <= 128,
                         (2 * base_array * top_array) / 255,
                         255 - 2 * (255 - base_array) * (255 - top_array) / 255)
        
        return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8))
    
    def display_image(self, image: Image.Image):
        """显示图像到画布"""
        # 应用缩放
        scaled_width = int(image.width * self.zoom_level)
        scaled_height = int(image.height * self.zoom_level)
        scaled_image = image.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)
        
        # 转换为PhotoImage
        self.photo_image = ImageTk.PhotoImage(scaled_image)
        
        # 清除画布并显示图像
        self.canvas.delete("all")
        self.canvas.create_image(self.pan_offset[0], self.pan_offset[1], 
                               image=self.photo_image, anchor=tk.NW)
    
    # 工具方法
    def set_tool(self, tool: str):
        """设置当前工具"""
        self.current_tool = tool
        self.status_label.config(text=f"当前工具: {tool}")
    
    def on_brush_size_change(self, event):
        """画笔大小改变"""
        self.brush_size = self.brush_size_var.get()
    
    def choose_brush_color(self):
        """选择画笔颜色"""
        color = colorchooser.askcolor(title="选择画笔颜色")
        if color[1]:
            self.brush_color = tuple(int(x) for x in color[1].split(',') if x.isdigit())
    
    def on_layer_select(self, event):
        """图层选择事件"""
        selection = self.layer_listbox.curselection()
        if selection:
            self.active_layer_index = len(self.layers) - 1 - selection[0]
            self.update_property_panel()
    
    def update_property_panel(self):
        """更新属性面板"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            self.opacity_var.set(layer.opacity)
            self.blend_mode_var.set(layer.blend_mode)
    
    def on_opacity_change(self, event):
        """不透明度改变"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            layer.opacity = self.opacity_var.get()
            self.render_canvas()
    
    def on_blend_mode_change(self, event):
        """混合模式改变"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            layer.blend_mode = self.blend_mode_var.get()
            self.render_canvas()
    
    def on_brightness_change(self, event):
        """亮度改变"""
        if 0 <= self.active_layer_index < len(self.layers):
            self.apply_adjustments()
    
    def on_contrast_change(self, event):
        """对比度改变"""
        if 0 <= self.active_layer_index < len(self.layers):
            self.apply_adjustments()
    
    def on_saturation_change(self, event):
        """饱和度改变"""
        if 0 <= self.active_layer_index < len(self.layers):
            self.apply_adjustments()
    
    def apply_adjustments(self):
        """应用图像调整"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            
            # 创建调整后的图像
            adjusted_image = layer.original_image.copy()
            
            # 应用亮度
            if self.brightness_var.get() != 1.0:
                enhancer = ImageEnhance.Brightness(adjusted_image)
                adjusted_image = enhancer.enhance(self.brightness_var.get())
            
            # 应用对比度
            if self.contrast_var.get() != 1.0:
                enhancer = ImageEnhance.Contrast(adjusted_image)
                adjusted_image = enhancer.enhance(self.contrast_var.get())
            
            # 应用饱和度
            if self.saturation_var.get() != 1.0:
                enhancer = ImageEnhance.Color(adjusted_image)
                adjusted_image = enhancer.enhance(self.saturation_var.get())
            
            layer.current_image = adjusted_image
            self.render_canvas()
    
    def apply_preset(self, preset_name: str):
        """应用预设滤镜"""
        if preset_name in self.filter_presets:
            preset = self.filter_presets[preset_name]
            
            # 设置调整参数
            self.brightness_var.set(preset.get("brightness", 1.0))
            self.contrast_var.set(preset.get("contrast", 1.0))
            self.saturation_var.set(preset.get("saturation", 1.0))
            
            # 应用调整
            self.apply_adjustments()
    
    def apply_filter(self, filter_name: str):
        """应用滤镜"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            
            if filter_name == "blur":
                layer.current_image = layer.original_image.filter(ImageFilter.BLUR)
            elif filter_name == "sharpen":
                layer.current_image = layer.original_image.filter(ImageFilter.SHARPEN)
            
            self.render_canvas()
    
    # 图层操作
    def add_layer(self):
        """添加图层"""
        new_image = Image.new("RGBA", (self.canvas_width, self.canvas_height), (0, 0, 0, 0))
        layer_name = f"图层 {len(self.layers)}"
        new_layer = Layer(layer_name, new_image)
        self.layers.append(new_layer)
        self.active_layer_index = len(self.layers) - 1
        self.update_layer_list()
        self.render_canvas()
    
    def delete_layer(self):
        """删除图层"""
        if len(self.layers) > 1 and 0 <= self.active_layer_index < len(self.layers):
            del self.layers[self.active_layer_index]
            self.active_layer_index = max(0, self.active_layer_index - 1)
            self.update_layer_list()
            self.render_canvas()
    
    def duplicate_layer(self):
        """复制图层"""
        if 0 <= self.active_layer_index < len(self.layers):
            original_layer = self.layers[self.active_layer_index]
            new_layer = Layer(f"{original_layer.name} 副本", 
                            original_layer.current_image.copy(),
                            original_layer.visible, original_layer.opacity)
            new_layer.blend_mode = original_layer.blend_mode
            new_layer.position = original_layer.position
            new_layer.scale = original_layer.scale
            new_layer.rotation = original_layer.rotation
            
            self.layers.append(new_layer)
            self.active_layer_index = len(self.layers) - 1
            self.update_layer_list()
            self.render_canvas()
    
    def merge_layers(self):
        """合并图层"""
        if len(self.layers) > 1:
            # 合并所有可见图层
            composite_image = Image.new("RGBA", (self.canvas_width, self.canvas_height), (0, 0, 0, 0))
            
            for layer in self.layers:
                if layer.visible:
                    transformed_image = self.apply_layer_transforms(layer)
                    composite_image = self.blend_layers(composite_image, transformed_image, layer)
            
            # 创建新的合并图层
            merged_layer = Layer("合并图层", composite_image)
            self.layers = [merged_layer]
            self.active_layer_index = 0
            self.update_layer_list()
            self.render_canvas()
    
    # 文件操作
    def new_project(self):
        """新建项目"""
        # 清空所有图层
        self.layers.clear()
        self.active_layer_index = -1
        
        # 创建新的背景图层
        background_image = Image.new("RGBA", (self.canvas_width, self.canvas_height), (255, 255, 255, 255))
        background_layer = Layer("背景", background_image)
        self.layers.append(background_layer)
        self.active_layer_index = 0
        
        self.update_layer_list()
        self.render_canvas()
        self.status_label.config(text="新建项目")
    
    def open_image(self):
        """打开图像"""
        file_path = filedialog.askopenfilename(
            title="打开图像",
            filetypes=[
                ("图像文件", "*.png *.jpg *.jpeg *.bmp *.gif *.tiff"),
                ("PNG文件", "*.png"),
                ("JPEG文件", "*.jpg *.jpeg"),
                ("所有文件", "*.*")
            ]
        )
        
        if file_path:
            try:
                image = Image.open(file_path).convert("RGBA")
                
                # 调整图像大小以适应画布
                if image.size != (self.canvas_width, self.canvas_height):
                    image = image.resize((self.canvas_width, self.canvas_height), Image.Resampling.LANCZOS)
                
                # 创建新图层
                layer_name = os.path.basename(file_path)
                new_layer = Layer(layer_name, image)
                self.layers.append(new_layer)
                self.active_layer_index = len(self.layers) - 1
                
                self.update_layer_list()
                self.render_canvas()
                self.status_label.config(text=f"已打开: {layer_name}")
                
            except Exception as e:
                messagebox.showerror("错误", f"无法打开图像: {e}")
    
    def save_image(self):
        """保存图像"""
        if not self.layers:
            messagebox.showwarning("警告", "没有可保存的内容")
            return
        
        # 渲染最终图像
        composite_image = Image.new("RGBA", (self.canvas_width, self.canvas_height), (0, 0, 0, 0))
        
        for layer in self.layers:
            if layer.visible:
                transformed_image = self.apply_layer_transforms(layer)
                composite_image = self.blend_layers(composite_image, transformed_image, layer)
        
        # 保存图像
        file_path = filedialog.asksaveasfilename(
            title="保存图像",
            defaultextension=".png",
            filetypes=[
                ("PNG文件", "*.png"),
                ("JPEG文件", "*.jpg"),
                ("BMP文件", "*.bmp"),
                ("所有文件", "*.*")
            ]
        )
        
        if file_path:
            try:
                composite_image.save(file_path)
                self.status_label.config(text=f"已保存: {os.path.basename(file_path)}")
            except Exception as e:
                messagebox.showerror("错误", f"保存失败: {e}")
    
    def save_as_image(self):
        """另存为图像"""
        self.save_image()
    
    # 编辑操作
    def undo(self):
        """撤销操作"""
        if self.history_index > 0:
            self.history_index -= 1
            self.restore_from_history()
    
    def redo(self):
        """重做操作"""
        if self.history_index < len(self.history) - 1:
            self.history_index += 1
            self.restore_from_history()
    
    def copy_selection(self):
        """复制选择区域"""
        if self.selection:
            # 实现复制功能
            pass
    
    def paste_image(self):
        """粘贴图像"""
        # 从剪贴板粘贴图像
        try:
            from PIL import ImageGrab
            clipboard_image = ImageGrab.grabclipboard()
            if clipboard_image:
                clipboard_image = clipboard_image.convert("RGBA")
                
                # 调整大小以适应画布
                if clipboard_image.size != (self.canvas_width, self.canvas_height):
                    clipboard_image = clipboard_image.resize((self.canvas_width, self.canvas_height), Image.Resampling.LANCZOS)
                
                # 创建新图层
                new_layer = Layer("粘贴图层", clipboard_image)
                self.layers.append(new_layer)
                self.active_layer_index = len(self.layers) - 1
                
                self.update_layer_list()
                self.render_canvas()
                self.status_label.config(text="已粘贴图像")
        except Exception as e:
            messagebox.showerror("错误", f"粘贴失败: {e}")
    
    def select_all(self):
        """全选"""
        self.selection = (0, 0, self.canvas_width, self.canvas_height)
        self.render_canvas()
    
    def clear_selection(self):
        """清除选择"""
        self.selection = None
        self.render_canvas()
    
    def add_to_history(self):
        """添加到历史记录"""
        # 保存当前状态
        state = {
            'layers': [(layer.name, layer.current_image.copy()) for layer in self.layers],
            'active_layer_index': self.active_layer_index
        }
        
        # 移除当前位置之后的历史记录
        self.history = self.history[:self.history_index + 1]
        self.history.append(state)
        
        # 限制历史记录数量
        if len(self.history) > self.max_history:
            self.history.pop(0)
        
        self.history_index = len(self.history) - 1
    
    def restore_from_history(self):
        """从历史记录恢复"""
        if 0 <= self.history_index < len(self.history):
            state = self.history[self.history_index]
            
            # 恢复图层
            self.layers.clear()
            for name, image in state['layers']:
                layer = Layer(name, image)
                self.layers.append(layer)
            
            # 恢复活动图层
            self.active_layer_index = state['active_layer_index']
            
            self.update_layer_list()
            self.render_canvas()
    
    # 画布事件处理
    def on_canvas_click(self, event):
        """画布点击事件"""
        # 转换坐标
        x = (event.x - self.pan_offset[0]) / self.zoom_level
        y = (event.y - self.pan_offset[1]) / self.zoom_level
        
        if self.current_tool == "select":
            self.selection_start = (x, y)
            self.selection_end = (x, y)
        elif self.current_tool == "brush":
            self.draw_brush_stroke(x, y)
        elif self.current_tool == "eraser":
            self.erase_at_point(x, y)
        elif self.current_tool == "magic_wand":
            self.magic_wand_select(x, y)
    
    def on_canvas_drag(self, event):
        """画布拖拽事件"""
        # 转换坐标
        x = (event.x - self.pan_offset[0]) / self.zoom_level
        y = (event.y - self.pan_offset[1]) / self.zoom_level
        
        if self.current_tool == "select":
            self.selection_end = (x, y)
            self.render_canvas()
        elif self.current_tool == "brush":
            self.draw_brush_stroke(x, y)
        elif self.current_tool == "eraser":
            self.erase_at_point(x, y)
    
    def on_canvas_release(self, event):
        """画布释放事件"""
        if self.current_tool == "select" and self.selection_start and self.selection_end:
            # 确定选择区域
            x1, y1 = self.selection_start
            x2, y2 = self.selection_end
            self.selection = (min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))
            self.render_canvas()
    
    def on_mouse_wheel(self, event):
        """鼠标滚轮事件"""
        # 缩放画布
        if event.delta > 0:
            self.zoom_level *= 1.1
        else:
            self.zoom_level /= 1.1
        
        # 限制缩放范围
        self.zoom_level = max(0.1, min(5.0, self.zoom_level))
        
        self.render_canvas()
    
    def on_canvas_motion(self, event):
        """画布鼠标移动事件"""
        # 更新坐标显示
        x = (event.x - self.pan_offset[0]) / self.zoom_level
        y = (event.y - self.pan_offset[1]) / self.zoom_level
        self.coord_label.config(text=f"坐标: ({int(x)}, {int(y)})")
    
    # 绘图工具
    def draw_brush_stroke(self, x: float, y: float):
        """绘制画笔笔触"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            
            # 创建绘图对象
            draw = ImageDraw.Draw(layer.current_image)
            
            # 绘制圆形笔触
            radius = self.brush_size // 2
            draw.ellipse([x - radius, y - radius, x + radius, y + radius], 
                        fill=self.brush_color)
            
            self.render_canvas()
    
    def erase_at_point(self, x: float, y: float):
        """在指定点擦除"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            
            # 创建绘图对象
            draw = ImageDraw.Draw(layer.current_image)
            
            # 擦除（设置为透明）
            radius = self.eraser_size // 2
            draw.ellipse([x - radius, y - radius, x + radius, y + radius], 
                        fill=(0, 0, 0, 0))
            
            self.render_canvas()
    
    def magic_wand_select(self, x: float, y: float):
        """魔术棒选择"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            
            # 获取点击位置的颜色
            try:
                color = layer.current_image.getpixel((int(x), int(y)))
                
                # 创建选择遮罩
                mask = self.create_color_selection_mask(layer.current_image, color, tolerance=30)
                
                # 创建选择图层
                selection_layer = Layer("选择", mask)
                self.layers.append(selection_layer)
                self.active_layer_index = len(self.layers) - 1
                
                self.update_layer_list()
                self.render_canvas()
                
            except IndexError:
                pass
    
    def create_color_selection_mask(self, image: Image.Image, target_color: Tuple[int, int, int, int], tolerance: int = 30) -> Image.Image:
        """创建颜色选择遮罩"""
        # 转换为numpy数组
        img_array = np.array(image)
        
        # 计算颜色差异
        color_diff = np.sqrt(np.sum((img_array - target_color) ** 2, axis=2))
        
        # 创建遮罩
        mask = color_diff <= tolerance
        
        # 转换为图像
        mask_image = Image.fromarray(mask.astype(np.uint8) * 255, mode='L')
        
        return mask_image
    
    # 高级功能
    def apply_advanced_filter(self, filter_name: str, parameters: Dict):
        """应用高级滤镜"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            
            if filter_name == "gaussian_blur":
                radius = parameters.get("radius", 2)
                layer.current_image = layer.original_image.filter(ImageFilter.GaussianBlur(radius))
            elif filter_name == "edge_enhance":
                layer.current_image = layer.original_image.filter(ImageFilter.EDGE_ENHANCE)
            elif filter_name == "emboss":
                layer.current_image = layer.original_image.filter(ImageFilter.EMBOSS)
            elif filter_name == "find_edges":
                layer.current_image = layer.original_image.filter(ImageFilter.FIND_EDGES)
            
            self.render_canvas()
    
    def apply_color_correction(self, brightness: float = 1.0, contrast: float = 1.0, 
                              saturation: float = 1.0, hue: float = 0.0):
        """应用颜色校正"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            
            # 应用各种调整
            adjusted_image = layer.original_image.copy()
            
            if brightness != 1.0:
                enhancer = ImageEnhance.Brightness(adjusted_image)
                adjusted_image = enhancer.enhance(brightness)
            
            if contrast != 1.0:
                enhancer = ImageEnhance.Contrast(adjusted_image)
                adjusted_image = enhancer.enhance(contrast)
            
            if saturation != 1.0:
                enhancer = ImageEnhance.Color(adjusted_image)
                adjusted_image = enhancer.enhance(saturation)
            
            layer.current_image = adjusted_image
            self.render_canvas()
    
    def create_mask_from_alpha(self):
        """从透明度创建遮罩"""
        if 0 <= self.active_layer_index < len(self.layers):
            layer = self.layers[self.active_layer_index]
            
            # 获取alpha通道
            alpha = layer.current_image.split()[-1]
            
            # 创建遮罩图层
            mask_layer = Layer("Alpha遮罩", alpha)
            self.layers.append(mask_layer)
            self.active_layer_index = len(self.layers) - 1
            
            self.update_layer_list()
            self.render_canvas()
    
    def merge_visible_layers(self):
        """合并可见图层"""
        if len(self.layers) > 1:
            # 只合并可见图层
            visible_layers = [layer for layer in self.layers if layer.visible]
            
            if len(visible_layers) > 1:
                composite_image = Image.new("RGBA", (self.canvas_width, self.canvas_height), (0, 0, 0, 0))
                
                for layer in visible_layers:
                    transformed_image = self.apply_layer_transforms(layer)
                    composite_image = self.blend_layers(composite_image, transformed_image, layer)
                
                # 创建合并图层
                merged_layer = Layer("合并可见图层", composite_image)
                
                # 替换可见图层为合并图层
                new_layers = []
                for layer in self.layers:
                    if not layer.visible:
                        new_layers.append(layer)
                    elif layer == visible_layers[0]:  # 第一个可见图层替换为合并图层
                        new_layers.append(merged_layer)
                
                self.layers = new_layers
                self.active_layer_index = len(self.layers) - 1
                
                self.update_layer_list()
                self.render_canvas()
    
    def export_layers(self, directory: str):
        """导出所有图层"""
        if not os.path.exists(directory):
            os.makedirs(directory)
        
        for i, layer in enumerate(self.layers):
            filename = f"layer_{i:02d}_{layer.name}.png"
            filepath = os.path.join(directory, filename)
            
            try:
                layer.current_image.save(filepath)
            except Exception as e:
                print(f"导出图层失败 {filename}: {e}")
        
        self.status_label.config(text=f"已导出 {len(self.layers)} 个图层到 {directory}")
    
    def import_layers(self, directory: str):
        """导入图层"""
        if not os.path.exists(directory):
            return
        
        # 获取所有图像文件
        image_files = []
        for filename in os.listdir(directory):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
                image_files.append(os.path.join(directory, filename))
        
        # 按文件名排序
        image_files.sort()
        
        # 导入图层
        for filepath in image_files:
            try:
                image = Image.open(filepath).convert("RGBA")
                
                # 调整大小以适应画布
                if image.size != (self.canvas_width, self.canvas_height):
                    image = image.resize((self.canvas_width, self.canvas_height), Image.Resampling.LANCZOS)
                
                # 创建图层
                layer_name = os.path.splitext(os.path.basename(filepath))[0]
                new_layer = Layer(layer_name, image)
                self.layers.append(new_layer)
                
            except Exception as e:
                print(f"导入图层失败 {filepath}: {e}")
        
        if image_files:
            self.active_layer_index = len(self.layers) - 1
            self.update_layer_list()
            self.render_canvas()
            self.status_label.config(text=f"已导入 {len(image_files)} 个图层")
    
    def cleanup(self):
        """清理插件资源"""
        if self.window and self.window.winfo_exists():
            self.window.destroy()
        self.window = None
        self.canvas = None
        self.layers.clear()
        self.history.clear()
        print(f"图片编辑器插件已清理: {self.name}")
       