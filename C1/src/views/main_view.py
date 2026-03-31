# src/views/main_view.py - 修复导入错误
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
from typing import Optional, Callable, List, Tuple, TYPE_CHECKING  # 添加 Tuple 导入
from ..utils.image_splitter import ImageSplitter
from ..models.sprite_types import SpriteType, ActionType, DirectionType

if TYPE_CHECKING:
    from ..controllers.main_controller import MainController


class MainView:
    """主视图类 - 负责UI界面"""

    def __init__(self, root, logger):
        self.root = root
        self.logger = logger
        self.controller: Optional['MainController'] = None

        # UI变量
        self.sprite_type_var = tk.StringVar(value="scene")
        self.sprite_id_var = tk.StringVar()
        self.action_var = tk.StringVar(value="stand")
        self.animation_speed_var = tk.IntVar(value=100)
        self.offset_x_var = tk.IntVar(value=0)
        self.offset_y_var = tk.IntVar(value=0)

        # 地图显示选项
        self.show_walkable_var = tk.BooleanVar(value=True)
        self.show_blocked_var = tk.BooleanVar(value=True)
        self.show_masked_var = tk.BooleanVar(value=True)

        # UI组件
        self.sprite_id_combo: Optional[ttk.Combobox] = None
        self.action_frame: Optional[ttk.LabelFrame] = None
        self.direction_frame: Optional[ttk.LabelFrame] = None
        self.animation_offset_notebook: Optional[ttk.Notebook] = None
        self.canvas: Optional[tk.Canvas] = None
        self.info_label: Optional[ttk.Label] = None
        self.play_button: Optional[ttk.Button] = None
        self.tools_frame: Optional[ttk.LabelFrame] = None
        self.map_tools_frame: Optional[ttk.Frame] = None
        self.map_tools_standalone_frame: Optional[ttk.LabelFrame] = None
        self.sprite_tools_frame: Optional[ttk.Frame] = None

        self.selected_resource_path: str = ""  # 拆图所选json文件路径

        self.setup_ui()

    def set_controller(self, controller):
        """设置控制器"""
        self.controller = controller

    def setup_ui(self):
        """设置用户界面"""
        # 主框架
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # 创建主Tab页面
        self.setup_main_tabs(main_frame)

    def setup_main_tabs(self, parent):
        """设置主Tab页面"""
        self.main_notebook = ttk.Notebook(parent)
        self.main_notebook.pack(fill=tk.BOTH, expand=True)

        # 素材工具面板（第一个Tab）
        self.sprite_tools_tab = ttk.Frame(self.main_notebook)
        self.main_notebook.add(self.sprite_tools_tab, text="素材工具")
        self.setup_sprite_tools_panel(self.sprite_tools_tab)

        # 工具集面板（第二个Tab）
        self.tools_collection_tab = ttk.Frame(self.main_notebook)
        self.main_notebook.add(self.tools_collection_tab, text="工具集")
        self.setup_tools_collection_panel(self.tools_collection_tab)

        # 软件说明面板（第三个Tab）
        self.help_tab = ttk.Frame(self.main_notebook)
        self.main_notebook.add(self.help_tab, text="软件说明")
        self.setup_help_panel(self.help_tab)

    def setup_sprite_tools_panel(self, parent):
        """设置素材工具面板（原有的所有功能）"""
        # 创建水平分割的框架
        sprite_main_frame = ttk.Frame(parent)
        sprite_main_frame.pack(fill=tk.BOTH, expand=True)

        # 左侧控制面板
        self.setup_control_panel(sprite_main_frame)

        # 右侧显示区域
        self.setup_display_area(sprite_main_frame)

    def setup_tools_collection_panel(self, parent):
        """设置工具集面板"""
        # 创建滚动框架
        canvas = tk.Canvas(parent)
        scrollbar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        # 标题
        title_label = ttk.Label(scrollable_frame, text="工具集", font=("Arial", 16, "bold"))
        title_label.pack(pady=20)

        # 拆图工具
        self.setup_image_splitter_tool(scrollable_frame)

        # 预留扩展空间
        expansion_frame = ttk.LabelFrame(scrollable_frame, text="更多工具（待扩展）")
        expansion_frame.pack(fill=tk.X, padx=20, pady=10)
        
        ttk.Label(expansion_frame, text="这里可以添加更多工具功能", 
                 font=("Arial", 10)).pack(pady=20)

        # 布局
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def setup_image_splitter_tool(self, parent):
        """设置拆图工具"""
        tool_frame = ttk.LabelFrame(parent, text="图片拆图工具")
        tool_frame.pack(fill=tk.X, padx=20, pady=10)

        # 说明文字
        description = ttk.Label(tool_frame, text=(
            "功能说明：\n"
            "• 选择包含PNG图片和JSON配置文件的资源文件\n"
            "• 根据JSON中的坐标信息将大图拆分成多个小图\n"
            "• 拆解后的小图将保存到原文件夹的'拆图'子文件夹中\n"
            "• 支持chat.json格式的配置文件"
        ), justify=tk.LEFT)
        description.pack(pady=10, padx=10)

        # 按钮框架
        button_frame = ttk.Frame(tool_frame)
        button_frame.pack(pady=10)

        # 选择文件按钮
        select_button = ttk.Button(
            button_frame,
            text="选择资源文件",
            command=self._on_select_resource_file
        )
        select_button.pack(side=tk.LEFT, padx=5)

        # 执行拆图按钮
        split_button = ttk.Button(
            button_frame,
            text="执行拆图",
            command=self._on_execute_image_split
        )
        split_button.pack(side=tk.LEFT, padx=5)

        # 状态标签
        self.split_status_label = ttk.Label(tool_frame, text="等待选择文件...", 
                                           foreground="gray")
        self.split_status_label.pack(pady=5)

    def setup_help_panel(self, parent):
        """设置软件说明面板"""
        # 创建滚动框架
        canvas = tk.Canvas(parent)
        scrollbar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        # 标题
        title_label = ttk.Label(scrollable_frame, text="序列帧素材查看器 - 使用说明", 
                               font=("Arial", 16, "bold"))
        title_label.pack(pady=20)

        # 软件介绍
        intro_frame = ttk.LabelFrame(scrollable_frame, text="软件介绍")
        intro_frame.pack(fill=tk.X, padx=20, pady=10)
        
        intro_text = ttk.Label(intro_frame, text=(
            "这是一个专业的游戏素材查看和管理工具，支持多种素材格式和动画效果。\n\n"
            "主要功能：\n"
            "• 查看和管理游戏素材（场景、地图、角色等）\n"
            "• 支持动画播放和帧控制\n"
            "• 提供多种工具集功能\n"
            "• 支持素材的导入、导出和管理"
        ), justify=tk.LEFT)
        intro_text.pack(pady=10, padx=10)

        # 使用说明
        usage_frame = ttk.LabelFrame(scrollable_frame, text="使用说明")
        usage_frame.pack(fill=tk.X, padx=20, pady=10)
        
        usage_text = ttk.Label(usage_frame, text=(
            "素材工具面板：\n"
            "1. 选择素材类型（场景素材或地图素材）\n"
            "2. 选择素材文件夹\n"
            "3. 选择具体的素材ID\n"
            "4. 使用动作和方向控制查看动画\n"
            "5. 调整动画速度和偏移参数\n\n"
            
            "工具集面板：\n"
            "• 提供各种实用工具，如拆图工具等\n"
            "• 更多工具功能正在开发中\n\n"
            
            "注意事项：\n"
            "• 确保素材文件格式正确\n"
            "• 大文件加载可能需要一些时间\n"
            "• 建议定期清理缓存以优化性能"
        ), justify=tk.LEFT)
        usage_text.pack(pady=10, padx=10)

        # 版本信息
        version_frame = ttk.LabelFrame(scrollable_frame, text="版本信息")
        version_frame.pack(fill=tk.X, padx=20, pady=10)
        
        version_text = ttk.Label(version_frame, text=(
            "版本：1.0.0\n"
            "更新日期：2024年\n"
            "支持格式：PNG、JPG、JSON\n"
            "系统要求：Windows 10+"
        ), justify=tk.LEFT)
        version_text.pack(pady=10, padx=10)

        # 布局
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def setup_control_panel(self, parent):
        """设置控制面板"""
        control_frame = ttk.LabelFrame(parent, text="控制面板")
        control_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        
        # 保存控制面板的引用
        self.control_frame = control_frame

        # 素材类型选择
        self.setup_sprite_type_selection(control_frame)
        self.sprite_type_frame = control_frame.winfo_children()[-1]  # 保存引用

        # 子类型选择（仅用于scene类型）- 紧接着素材类型显示
        self.setup_subtype_selection(control_frame)
        self.subtype_frame = control_frame.winfo_children()[-1]  # 保存引用

        # 文件夹选择
        self.setup_folder_selection(control_frame)
        self.folder_frame = control_frame.winfo_children()[-1]  # 保存引用

        # ID选择
        self.setup_id_selection(control_frame)
        self.id_frame = control_frame.winfo_children()[-1]  # 保存引用

        # 动作选择
        self.setup_action_selection(control_frame)
        self.action_frame = control_frame.winfo_children()[-1]  # 保存引用

        # 方向控制
        self.setup_direction_control(control_frame)
        self.direction_frame = control_frame.winfo_children()[-1]  # 保存引用

        # 动画和偏移控制（使用tab）
        self.setup_animation_offset_tab(control_frame)
        self.animation_offset_notebook = control_frame.winfo_children()[-1]  # 保存引用

        # 工具、拆图工具和参考线背景（使用tab）
        self.setup_tools_tab(control_frame)
        self.tools_notebook = control_frame.winfo_children()[-1]  # 保存引用
        
        # 地图工具（独立框架，用于地图类型）
        self.setup_map_tools_standalone(control_frame)
        self.map_tools_standalone_frame = control_frame.winfo_children()[-1]  # 保存引用
        
        # 保留素材管理（使用tab）
        self.setup_retained_sprites_tab(control_frame)
        self.retained_notebook = control_frame.winfo_children()[-1]  # 保存引用

    def setup_sprite_type_selection(self, parent):
        """设置素材类型选择"""
        ttk.Label(parent, text="素材类型:").pack(pady=5)

        type_frame = ttk.Frame(parent)
        type_frame.pack(pady=5)

        sprite_types = [
            ("场景素材", "scene"),
            ("地图素材", "map"),
            ("凡人修仙H5地图", "h5_map")
        ]

        # 每行显示2个按钮
        for i in range(0, len(sprite_types), 2):
            row_frame = ttk.Frame(type_frame)
            row_frame.pack(fill=tk.X, pady=1)
            
            # 第一个按钮
            ttk.Radiobutton(
                row_frame,
                text=sprite_types[i][0],
                variable=self.sprite_type_var,
                value=sprite_types[i][1],
                command=self._on_sprite_type_change
            ).pack(side=tk.LEFT, anchor=tk.W, padx=(0, 10))
            
            # 第二个按钮（如果存在）
            if i + 1 < len(sprite_types):
                ttk.Radiobutton(
                    row_frame,
                    text=sprite_types[i + 1][0],
                    variable=self.sprite_type_var,
                    value=sprite_types[i + 1][1],
                    command=self._on_sprite_type_change
                ).pack(side=tk.LEFT, anchor=tk.W)

    def setup_folder_selection(self, parent):
        """设置文件夹选择"""
        ttk.Button(
            parent,
            text="选择素材文件夹",
            command=self._on_select_folder
        ).pack(pady=10)

    def setup_subtype_selection(self, parent):
        """设置子类型选择"""
        self.subtype_frame = ttk.LabelFrame(parent, text="子类型选择")
        # 默认显示子类型选择，因为默认选择的是场景素材
        self.subtype_frame.pack(pady=5, fill=tk.X, padx=10)
        
        self.subtype_var = tk.StringVar()
        self.subtype_combo = ttk.Combobox(
            self.subtype_frame,
            textvariable=self.subtype_var,
            width=20,
            state="readonly"
        )
        self.subtype_combo.pack(pady=5)
        self.subtype_combo.bind("<<ComboboxSelected>>", self._on_subtype_change)

    def setup_id_selection(self, parent):
        """设置ID选择"""
        id_frame = ttk.Frame(parent)
        id_frame.pack(pady=5, fill=tk.X, padx=10)

        ttk.Label(id_frame, text="素材ID:").pack(side=tk.LEFT)

        self.sprite_id_combo = ttk.Combobox(
            id_frame,
            textvariable=self.sprite_id_var,
            width=12,
            state="readonly"
        )
        self.sprite_id_combo.pack(side=tk.LEFT, padx=5)
        self.sprite_id_combo.bind("<<ComboboxSelected>>", self._on_sprite_id_change)

        ttk.Button(
            id_frame,
            text="刷新ID",
            command=self._on_refresh_ids
        ).pack(side=tk.LEFT)

    def setup_action_selection(self, parent):
        """设置动作选择"""
        self.action_frame = ttk.LabelFrame(parent, text="动作选择")
        # 默认不显示，由update_tools_display控制显示
        self.action_frame.pack_forget()  # 确保默认隐藏

        # 动作选择按钮将在更新时动态创建
        # 添加播放按钮到动作框架
        play_frame = ttk.Frame(self.action_frame)
        play_frame.pack(pady=5)
        
        self.play_button = ttk.Button(
            play_frame,
            text="播放",
            command=self._on_toggle_animation
        )
        self.play_button.pack(side=tk.LEFT, padx=5)

    def setup_direction_control(self, parent):
        """设置方向控制"""
        self.direction_frame = ttk.LabelFrame(parent, text="方向控制")
        # 默认不显示，由update_tools_display控制显示
        self.direction_frame.pack_forget()  # 确保默认隐藏

        # 创建方向控制容器，使用网格布局
        self.dir_buttons = ttk.Frame(self.direction_frame)
        self.dir_buttons.pack(pady=5)
        
        # 存储方向按钮的引用，以便动态更新
        self.direction_buttons = {}
        
        # 存储当前选中的方向
        self.current_direction = "down"
        
        # 初始化方向按钮（8个方向围绕中心点）
        self._update_direction_buttons()

    def _update_direction_buttons(self, available_directions=None):
        """更新方向按钮显示"""
        # 清除现有按钮
        for widget in self.dir_buttons.winfo_children():
            widget.destroy()
        
        # 清除旧的按钮引用，防止访问已销毁的按钮
        self.direction_buttons.clear()
        
        # 如果没有指定可用方向，使用默认的8个方向
        if available_directions is None:
            available_directions = [
                "up_left", "up", "up_right",
                "left", "right",
                "down_left", "down", "down_right"
            ]
        
        # 使用网格布局，按照用户要求的顺序：上 右上 右 右下 下 左下 左 左上
        # 围绕中心点布局
        direction_layout = [
            ("↑", "up"),           # 上
            ("↗", "up_right"),     # 右上  
            ("→", "right"),        # 右
            ("↘", "down_right"),   # 右下
            ("↓", "down"),         # 下
            ("↙", "down_left"),    # 左下
            ("←", "left"),         # 左
            ("↖", "up_left")      # 左上
        ]
        
        # 创建3x3网格，中心点留空
        grid_positions = [
            (0, 1),  # 上
            (0, 2),  # 右上
            (1, 2),  # 右
            (2, 2),  # 右下
            (2, 1),  # 下
            (2, 0),  # 左下
            (1, 0),  # 左
            (0, 0)   # 左上
        ]
        
        # 处理available_directions参数
        # 如果available_directions是元组列表，提取方向名称
        if available_directions and isinstance(available_directions[0], tuple):
            # 从元组列表中提取方向名称，过滤掉None值
            available_direction_names = [direction for _, direction in available_directions if direction is not None]
        else:
            # 如果available_directions是字符串列表或None，直接使用
            available_direction_names = available_directions
        
        for i, (text, direction) in enumerate(direction_layout):
            # 检查方向是否可用
            if available_direction_names is None or direction in available_direction_names:
                row, col = grid_positions[i]
                
                # 创建按钮，添加选中状态的视觉反馈
                btn = ttk.Button(
                    self.dir_buttons,
                    text=text,
                    width=3,
                    command=lambda d=direction: self._on_direction_change(d)
                )
                btn.grid(row=row, column=col, padx=2, pady=2)
                self.direction_buttons[direction] = btn
        
        # 在中心点添加一个标签
        center_label = ttk.Label(self.dir_buttons, text="●", font=("Arial", 12))
        center_label.grid(row=1, column=1, padx=2, pady=2)
        
        # 设置初始选中状态（在创建完所有按钮之后）
        if self.current_direction in self.direction_buttons:
            self._highlight_direction_button(self.current_direction)

    def _highlight_direction_button(self, direction: str):
        """高亮显示选中的方向按钮"""
        # 重置所有按钮样式
        for dir_name, btn in self.direction_buttons.items():
            btn.configure(style="TButton")
        
        # 高亮选中的按钮
        if direction in self.direction_buttons:
            # 使用更明显的样式来突出选中状态
            btn = self.direction_buttons[direction]
            btn.configure(style="Accent.TButton")
            
            # 如果Accent样式不存在，使用自定义样式
            try:
                btn.configure(relief="sunken", borderwidth=3)
            except:
                pass

    def setup_animation_control(self, parent):
        """设置动画控制"""
        self.play_button = ttk.Button(
            parent,
            text="播放",
            command=self._on_toggle_animation
        )
        self.play_button.pack(pady=5)

        ttk.Label(parent, text="动画速度(ms):").pack()

        speed_scale = ttk.Scale(
            parent,
            from_=10,
            to=500,
            variable=self.animation_speed_var,
            orient=tk.HORIZONTAL,
            command=self._on_speed_change
        )
        speed_scale.pack(fill=tk.X, padx=10, pady=5)

    def setup_offset_control(self, parent):
        """设置偏移调整"""
        ttk.Label(parent, text="X偏移:").pack()
        x_scale = ttk.Scale(
            parent,
            from_=-100,
            to=100,
            variable=self.offset_x_var,
            orient=tk.HORIZONTAL,
            command=self._on_offset_change
        )
        x_scale.pack(fill=tk.X, padx=10, pady=5)

        ttk.Label(parent, text="Y偏移:").pack()
        y_scale = ttk.Scale(
            parent,
            from_=-100,
            to=100,
            variable=self.offset_y_var,
            orient=tk.HORIZONTAL,
            command=self._on_offset_change
        )
        y_scale.pack(fill=tk.X, padx=10, pady=5)

    def setup_tools_area(self, parent):
        """设置工具区域"""
        self.tools_frame = ttk.LabelFrame(parent, text="工具")
        self.tools_frame.pack(pady=5, fill=tk.X, padx=10)

        # 通用按钮框架（日志、重置偏移、导出当前帧）
        self.common_btn_frame = ttk.Frame(self.tools_frame)
        # 默认不显示，由update_tools_display控制显示
        self.common_btn_frame.pack_forget()  # 确保默认隐藏

        # 第一行按钮（最多3个）
        common_btn_frame1 = ttk.Frame(self.common_btn_frame)
        common_btn_frame1.pack(fill=tk.X, pady=2)

        ttk.Button(
            common_btn_frame1,
            text="显示/隐藏日志",
            command=self._on_toggle_log
        ).pack(side=tk.LEFT, padx=2)

        ttk.Button(
            common_btn_frame1,
            text="重置偏移",
            command=self._on_reset_offset
        ).pack(side=tk.LEFT, padx=2)

        ttk.Button(
            common_btn_frame1,
            text="导出当前帧",
            command=self._on_export_frame
        ).pack(side=tk.LEFT, padx=2)
        
        # 第二行按钮（剩余按钮）
        common_btn_frame2 = ttk.Frame(self.common_btn_frame)
        common_btn_frame2.pack(fill=tk.X, pady=2)
        
        ttk.Button(
            common_btn_frame2,
            text="显示状态",
            command=self._on_show_state
        ).pack(side=tk.LEFT, padx=2)
        
        ttk.Button(
            common_btn_frame2,
            text="设置",
            command=self._on_show_settings
        ).pack(side=tk.LEFT, padx=2)
        
        ttk.Button(
            common_btn_frame2,
            text="插件管理",
            command=self._on_show_plugin_manager
        ).pack(side=tk.LEFT, padx=2)

        # 地图工具
        self.setup_map_tools()

        # 精灵工具（现在只包含通用按钮）
        self.setup_sprite_tools()

    def setup_map_tools(self):
        """设置地图工具"""
        self.map_tools_frame = ttk.Frame(self.tools_frame)

        # 地图缩放操作按钮
        zoom_frame = ttk.LabelFrame(self.map_tools_frame, text="缩放控制")
        zoom_frame.pack(fill=tk.X, pady=2)

        # 第一行按钮
        zoom_btn_frame1 = ttk.Frame(zoom_frame)
        zoom_btn_frame1.pack(fill=tk.X, pady=2)

        ttk.Button(zoom_btn_frame1, text="放大", command=self._on_map_zoom_in).pack(side=tk.LEFT, padx=2)
        ttk.Button(zoom_btn_frame1, text="缩小", command=self._on_map_zoom_out).pack(side=tk.LEFT, padx=2)
        ttk.Button(zoom_btn_frame1, text="重置", command=self._on_map_reset).pack(side=tk.LEFT, padx=2)

        # 第二行按钮
        zoom_btn_frame2 = ttk.Frame(zoom_frame)
        zoom_btn_frame2.pack(fill=tk.X, pady=2)

        ttk.Button(zoom_btn_frame2, text="自适应", command=self._on_map_fit).pack(side=tk.LEFT, padx=2)
        ttk.Button(zoom_btn_frame2, text="原始大小", command=self._on_map_max).pack(side=tk.LEFT, padx=2)

        # 地图导出操作按钮
        export_frame = ttk.LabelFrame(self.map_tools_frame, text="导出操作")
        export_frame.pack(fill=tk.X, pady=2)

        export_btn_frame = ttk.Frame(export_frame)
        export_btn_frame.pack(fill=tk.X, pady=2)

        ttk.Button(export_btn_frame, text="导出大地图", command=self._on_export_map).pack(side=tk.LEFT, padx=2)
        ttk.Button(export_btn_frame, text="导出当前视图", command=self._on_export_current_view).pack(side=tk.LEFT, padx=2)
        ttk.Button(export_btn_frame, text="导出遮罩图片", command=self._on_export_mask_images).pack(side=tk.LEFT, padx=2)

        # 地图显示选项
        map_display_frame = ttk.LabelFrame(self.map_tools_frame, text="显示选项")
        map_display_frame.pack(fill=tk.X, pady=5)

        ttk.Checkbutton(
            map_display_frame,
            text="可通行标记(绿色)",
            variable=self.show_walkable_var,
            command=self._on_map_display_change
        ).pack(anchor=tk.W, padx=5, pady=2)

        ttk.Checkbutton(
            map_display_frame,
            text="不可通行标记(红色)",
            variable=self.show_blocked_var,
            command=self._on_map_display_change
        ).pack(anchor=tk.W, padx=5, pady=2)

        ttk.Checkbutton(
            map_display_frame,
            text="遮罩标记(蓝色)",
            variable=self.show_masked_var,
            command=self._on_map_display_change
        ).pack(anchor=tk.W, padx=5, pady=2)

    def setup_map_tools_standalone(self, parent):
        """设置独立的地图工具框架"""
        self.map_tools_standalone_frame = ttk.LabelFrame(parent, text="地图工具")
        # 初始时隐藏，只在地图类型时显示
        self.map_tools_standalone_frame.pack_forget()

        # 通用按钮框架（只包含日志按钮）
        common_btn_frame = ttk.Frame(self.map_tools_standalone_frame)
        common_btn_frame.pack(fill=tk.X, pady=2)

        ttk.Button(
            common_btn_frame,
            text="显示/隐藏日志",
            command=self._on_toggle_log
        ).pack(side=tk.LEFT, padx=2)
        
        ttk.Button(
            common_btn_frame,
            text="显示状态",
            command=self._on_show_state
        ).pack(side=tk.LEFT, padx=2)
        
        ttk.Button(
            common_btn_frame,
            text="设置",
            command=self._on_show_settings
        ).pack(side=tk.LEFT, padx=2)

        # 地图缩放操作按钮
        zoom_frame = ttk.LabelFrame(self.map_tools_standalone_frame, text="缩放控制")
        zoom_frame.pack(fill=tk.X, pady=2)

        # 第一行按钮
        zoom_btn_frame1 = ttk.Frame(zoom_frame)
        zoom_btn_frame1.pack(fill=tk.X, pady=2)

        ttk.Button(zoom_btn_frame1, text="放大", command=self._on_map_zoom_in).pack(side=tk.LEFT, padx=2)
        ttk.Button(zoom_btn_frame1, text="缩小", command=self._on_map_zoom_out).pack(side=tk.LEFT, padx=2)
        ttk.Button(zoom_btn_frame1, text="重置", command=self._on_map_reset).pack(side=tk.LEFT, padx=2)

        # 第二行按钮
        zoom_btn_frame2 = ttk.Frame(zoom_frame)
        zoom_btn_frame2.pack(fill=tk.X, pady=2)

        ttk.Button(zoom_btn_frame2, text="自适应", command=self._on_map_fit).pack(side=tk.LEFT, padx=2)
        ttk.Button(zoom_btn_frame2, text="原始大小", command=self._on_map_max).pack(side=tk.LEFT, padx=2)

        # 地图导出操作按钮
        export_frame = ttk.LabelFrame(self.map_tools_standalone_frame, text="导出操作")
        export_frame.pack(fill=tk.X, pady=2)

        export_btn_frame = ttk.Frame(export_frame)
        export_btn_frame.pack(fill=tk.X, pady=2)

        # 第一行按钮
        export_btn_frame1 = ttk.Frame(export_frame)
        export_btn_frame1.pack(fill=tk.X, pady=2)
        
        ttk.Button(export_btn_frame1, text="导出大地图", command=self._on_export_map).pack(side=tk.LEFT, padx=2)
        ttk.Button(export_btn_frame1, text="导出当前视图", command=self._on_export_current_view).pack(side=tk.LEFT, padx=2)
        ttk.Button(export_btn_frame1, text="导出遮罩图片", command=self._on_export_mask_images).pack(side=tk.LEFT, padx=2)
        
        # 第二行按钮
        export_btn_frame2 = ttk.Frame(export_frame)
        export_btn_frame2.pack(fill=tk.X, pady=2)
        
        ttk.Button(export_btn_frame2, text="地图编辑器", command=self._on_open_map_editor).pack(side=tk.LEFT, padx=2)

        # 地图显示选项
        map_display_frame = ttk.LabelFrame(self.map_tools_standalone_frame, text="显示选项")
        map_display_frame.pack(fill=tk.X, pady=5)

        ttk.Checkbutton(
            map_display_frame,
            text="可通行标记(绿色)",
            variable=self.show_walkable_var,
            command=self._on_map_display_change
        ).pack(anchor=tk.W, padx=5, pady=2)

        ttk.Checkbutton(
            map_display_frame,
            text="不可通行标记(红色)",
            variable=self.show_blocked_var,
            command=self._on_map_display_change
        ).pack(anchor=tk.W, padx=5, pady=2)

        ttk.Checkbutton(
            map_display_frame,
            text="遮罩标记(蓝色)",
            variable=self.show_masked_var,
            command=self._on_map_display_change
        ).pack(anchor=tk.W, padx=5, pady=2)

    def setup_sprite_tools(self):
        """设置精灵工具"""
        self.sprite_tools_frame = ttk.Frame(self.tools_frame)
        
        # 精灵工具现在只包含通用按钮，拆图工具已移到单独的tab中

    def setup_tools_tab(self, parent):
        """设置工具、拆图工具和参考线背景的tab"""
        # 创建tab控件
        self.tools_notebook = ttk.Notebook(parent)
        # 不在这里pack，由update_tools_display控制显示
        
        # 通用工具tab
        self.general_tools_tab = ttk.Frame(self.tools_notebook)
        self.tools_notebook.add(self.general_tools_tab, text="通用工具")
        self.setup_tools_area(self.general_tools_tab)
        
        # 参考线和背景tab
        self.ref_bg_tab = ttk.Frame(self.tools_notebook)
        self.tools_notebook.add(self.ref_bg_tab, text="参考线和背景")
        self.setup_reference_and_background_tab(self.ref_bg_tab)
        
        # 拆图工具tab
        self.split_tools_tab = ttk.Frame(self.tools_notebook)
        self.tools_notebook.add(self.split_tools_tab, text="拆图工具")
        self.setup_split_tools(self.split_tools_tab)

    def setup_split_tools(self, parent):
        """设置拆图工具"""
        # 拆图按钮
        split_frame = ttk.LabelFrame(parent, text="拆图操作")
        split_frame.pack(fill=tk.X, pady=2)
        
        split_btn_frame = ttk.Frame(split_frame)
        split_btn_frame.pack(fill=tk.X, pady=2)
        
        ttk.Button(split_btn_frame, text="拆图当前ID", command=self._on_split_current_sprite).pack(side=tk.LEFT, padx=2)
        ttk.Button(split_btn_frame, text="拆图所有ID", command=self._on_split_all_sprites).pack(side=tk.LEFT, padx=2)

    def setup_reference_and_background_tab(self, parent):
        """设置参考线和背景tab"""
        # 参考线按钮
        ref_frame = ttk.LabelFrame(parent, text="参考线设置")
        ref_frame.pack(fill=tk.X, pady=2)
        ttk.Button(ref_frame, text="显示/隐藏参考线", command=self._on_toggle_reference_lines).pack(side=tk.LEFT, padx=2)
        
        # 背景设置按钮
        bg_frame = ttk.LabelFrame(parent, text="背景设置")
        bg_frame.pack(fill=tk.X, pady=2)
        ttk.Button(bg_frame, text="设置背景颜色", command=self._on_set_background_color).pack(side=tk.LEFT, padx=2)
        ttk.Button(bg_frame, text="透明背景", command=self._on_set_transparent_background).pack(side=tk.LEFT, padx=2)

    def setup_animation_offset_tab(self, parent):
        """设置动画和偏移控制的tab"""
        # 创建tab控件
        self.animation_offset_notebook = ttk.Notebook(parent)
        # 默认不显示，由update_tools_display控制显示
        self.animation_offset_notebook.pack_forget()  # 确保默认隐藏
        
        # 动画控制tab
        self.animation_tab = ttk.Frame(self.animation_offset_notebook)
        self.animation_offset_notebook.add(self.animation_tab, text="动画控制")
        self.setup_animation_control(self.animation_tab)
        
        # 偏移调整tab
        self.offset_tab = ttk.Frame(self.animation_offset_notebook)
        self.animation_offset_notebook.add(self.offset_tab, text="偏移调整")
        self.setup_offset_control(self.offset_tab)





    def setup_retained_sprites_tab(self, parent):
        """设置保留素材管理的tab"""
        # 创建tab控件
        self.retained_notebook = ttk.Notebook(parent)
        # 不在这里pack，由update_tools_display控制显示
        
        # 保留素材管理tab
        self.retained_manage_tab = ttk.Frame(self.retained_notebook)
        self.retained_notebook.add(self.retained_manage_tab, text="保留管理")
        self.setup_retained_management(self.retained_manage_tab)
        
        # 保留素材列表tab
        self.retained_list_tab = ttk.Frame(self.retained_notebook)
        self.retained_notebook.add(self.retained_list_tab, text="保留列表")
        self.setup_retained_list(self.retained_list_tab)

    def setup_retained_management(self, parent):
        """设置保留素材管理"""
        # 添加保留素材按钮
        add_frame = ttk.Frame(parent)
        add_frame.pack(fill=tk.X, pady=2)
        ttk.Button(add_frame, text="保留当前素材", command=self._on_retain_current_sprite).pack(side=tk.LEFT, padx=2)
        ttk.Button(add_frame, text="清除所有保留", command=self._on_clear_all_retained).pack(side=tk.LEFT, padx=2)

    def setup_retained_list(self, parent):
        """设置保留素材列表"""
        # 保留素材列表
        list_frame = ttk.Frame(parent)
        list_frame.pack(fill=tk.X, pady=2)
        ttk.Label(list_frame, text="保留的素材:").pack(anchor=tk.W)
        
        # 创建列表框
        self.retained_listbox = tk.Listbox(list_frame, height=4)
        self.retained_listbox.pack(fill=tk.X, pady=2)
        
        # 操作按钮
        btn_frame = ttk.Frame(parent)
        btn_frame.pack(fill=tk.X, pady=2)
        ttk.Button(btn_frame, text="引入选中", command=self._on_import_selected_sprite).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="移除选中", command=self._on_remove_selected_sprite).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="隐藏/显示", command=self._on_toggle_selected_visibility).pack(side=tk.LEFT, padx=2)

    def setup_display_area(self, parent):
        """设置显示区域"""
        display_frame = ttk.LabelFrame(parent, text="预览")
        display_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        # 画布
        self.canvas = tk.Canvas(display_frame, bg="gray20")
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # 绑定画布事件
        self.canvas.bind("<Configure>", self._on_canvas_configure)
        self.canvas.bind("<ButtonPress-1>", self._on_canvas_press)
        self.canvas.bind("<B1-Motion>", self._on_canvas_drag)
        self.canvas.bind("<MouseWheel>", self._on_canvas_wheel)
        self.canvas.bind("<Button-4>", self._on_canvas_wheel)
        self.canvas.bind("<Button-5>", self._on_canvas_wheel)

        # 信息标签
        info_frame = ttk.Frame(display_frame)
        info_frame.pack(fill=tk.X, padx=10, pady=5)

        self.info_label = ttk.Label(info_frame, text="请选择素材文件夹")
        self.info_label.pack()

    # 事件处理方法
    def _on_sprite_type_change(self):
        """素材类型改变事件"""
        if self.controller:
            sprite_type = self.sprite_type_var.get()
            
            # 根据类型显示/隐藏子类型选择
            if sprite_type == "scene":
                # 子类型框架已经在setup时pack了，这里只需要确保显示
                if not self.subtype_frame.winfo_ismapped():
                    # 确保子类型框架显示在正确的位置（在素材类型选择之后，文件夹选择之前）
                    # 使用保存的位置引用来确保正确的位置
                    self.subtype_frame.pack(pady=5, fill=tk.X, padx=10, after=self.sprite_type_frame)
            else:
                self.subtype_frame.pack_forget()
                # 清除子类型选择
                self.subtype_var.set("")
            
            self.controller.on_sprite_type_changed(sprite_type)

    def _on_subtype_change(self, event=None):
        """处理子类型改变"""
        if self.controller:
            self.controller.on_subtype_changed(self.subtype_var.get())

    def _on_select_folder(self):
        """选择文件夹事件"""
        folder = filedialog.askdirectory(title="选择素材根目录")
        if folder and self.controller:
            self.controller.on_folder_selected(folder)

    def _on_sprite_id_change(self, event=None):
        """精灵ID改变事件"""
        if self.controller:
            sprite_id = self.sprite_id_var.get()
            if sprite_id:
                self.controller.on_sprite_id_changed(sprite_id)

    def _on_refresh_ids(self):
        """刷新ID列表事件"""
        if self.controller:
            self.controller.on_refresh_ids()

    def _on_action_change(self):
        """动作改变事件"""
        if self.controller:
            action = self.action_var.get()
            self.controller.on_action_changed(action)

    def _on_direction_change(self, direction: str):
        """方向改变事件"""
        if self.controller:
            self.controller.on_direction_changed(direction)
            self.current_direction = direction # 更新当前选中的方向
            self._highlight_direction_button(direction) # 高亮显示选中的方向

    def _on_toggle_animation(self):
        """切换动画播放事件"""
        if self.controller:
            self.controller.on_toggle_animation()

    def _on_speed_change(self, value):
        """动画速度改变事件"""
        if self.controller:
            speed = int(float(value))
            self.controller.on_animation_speed_changed(speed)

    def _on_offset_change(self, value):
        """偏移改变事件"""
        if self.controller:
            offset_x = self.offset_x_var.get()
            offset_y = self.offset_y_var.get()
            self.controller.on_offset_changed(offset_x, offset_y)

    def _on_toggle_log(self):
        """切换日志显示事件"""
        if self.controller:
            self.controller.on_toggle_log()

    def _on_map_zoom_in(self):
        """地图放大事件"""
        if self.controller:
            self.controller.on_map_zoom(1.2)

    def _on_map_zoom_out(self):
        """地图缩小事件"""
        if self.controller:
            self.controller.on_map_zoom(0.8)

    def _on_map_reset(self):
        """地图重置事件"""
        if self.controller:
            self.controller.on_map_reset()

    def _on_export_map(self):
        """导出大地图事件"""
        if self.controller:
            self.controller.on_export_map()

    def _on_export_current_view(self):
        """导出当前视图事件"""
        if self.controller:
            self.controller.on_export_current_view()

    def _on_export_mask_images(self):
        """导出遮罩图片事件"""
        if self.controller:
            self.controller.on_export_mask_images()

    def _on_show_state(self):
        """显示状态窗口事件"""
        if self.controller:
            self.controller.on_show_state()

    def _on_show_settings(self):
        """显示设置"""
        if self.controller:
            self.controller.show_settings()
    
    def _on_show_plugin_manager(self):
        """显示插件管理器"""
        if self.controller:
            self.controller.show_plugin_manager()

    def _on_open_map_editor(self):
        """打开地图编辑器事件"""
        if self.controller:
            self.controller.on_open_map_editor()

    def _on_map_fit(self):
        """地图自适应事件"""
        if self.controller:
            self.controller.on_map_fit()

    def _on_map_max(self):
        """地图最大显示事件"""
        if self.controller:
            self.controller.on_map_max()

    def _on_map_display_change(self):
        """地图显示选项改变事件"""
        if self.controller:
            self.controller.on_map_display_changed(
                self.show_walkable_var.get(),
                self.show_blocked_var.get(),
                self.show_masked_var.get()
            )

    def _on_reset_offset(self):
        """重置偏移事件"""
        if self.controller:
            self.controller.on_reset_offset()

    def _on_export_frame(self):
        """导出当前帧事件"""
        if self.controller:
            self.controller.on_export_current_frame()

    def _on_canvas_configure(self, event):
        """画布配置改变事件"""
        if self.controller:
            self.controller.on_canvas_configure()

    def _on_canvas_press(self, event):
        """画布按下事件"""
        if self.controller:
            self.controller.on_canvas_press(event.x, event.y)

    def _on_canvas_drag(self, event):
        """画布拖拽事件"""
        if self.controller:
            self.controller.on_canvas_drag(event.x, event.y)

    def _on_canvas_wheel(self, event):
        """画布滚轮事件"""
        if self.controller:
            if hasattr(event, 'delta'):
                delta = event.delta
            elif event.num == 4:
                delta = 120
            elif event.num == 5:
                delta = -120
            else:
                delta = 0

            self.controller.on_canvas_wheel(event.x, event.y, delta)

    # 视图更新方法
    def update_subtypes(self, subtypes: List[str]):
        """更新子类型列表"""
        if subtypes:
            self.subtype_combo['values'] = subtypes
            if subtypes:
                # 设置第一个子类型
                self.subtype_combo.set(subtypes[0])
                # 设置变量值
                self.subtype_var.set(subtypes[0])
                # 延迟触发子类型改变事件，确保UI更新完成
                self.root.after(100, lambda: self._on_subtype_change())
            # 子类型框架已经在setup时pack了，这里只需要确保显示
            if not self.subtype_frame.winfo_ismapped():
                self.subtype_frame.pack(pady=5, fill=tk.X, padx=10)
        else:
            self.subtype_frame.pack_forget()

    def update_sprite_ids(self, sprite_ids: List[str]):
        """更新精灵ID列表"""
        if self.sprite_id_combo:
            self.sprite_id_combo['values'] = sprite_ids
            if sprite_ids:
                # 设置第一个ID并自动触发加载
                self.sprite_id_var.set(sprite_ids[0])
                # 延迟触发加载事件，确保UI更新完成
                self.root.after(100, self._on_sprite_id_change)
            else:
                self.sprite_id_var.set("")

    def update_actions(self, actions: List[str]):
        """更新动作选择"""
        # 清除现有动作按钮
        for widget in self.action_frame.winfo_children():
            widget.destroy()

        # 创建新的动作按钮，每行显示2个
        for i in range(0, len(actions), 2):
            row_frame = ttk.Frame(self.action_frame)
            row_frame.pack(fill=tk.X, pady=1)
            
            # 第一个按钮
            display_name1 = actions[i].replace("_", " ").title()
            ttk.Radiobutton(
                row_frame,
                text=display_name1,
                variable=self.action_var,
                value=actions[i],
                command=self._on_action_change
            ).pack(side=tk.LEFT, anchor=tk.W, padx=(0, 10))
            
            # 第二个按钮（如果存在）
            if i + 1 < len(actions):
                display_name2 = actions[i + 1].replace("_", " ").title()
                ttk.Radiobutton(
                    row_frame,
                    text=display_name2,
                    variable=self.action_var,
                    value=actions[i + 1],
                    command=self._on_action_change
                ).pack(side=tk.LEFT, anchor=tk.W)

    def update_directions(self, directions: List[str]):
        """更新方向按钮显示"""
        if hasattr(self, '_update_direction_buttons'):
            # 将方向列表转换为显示格式
            direction_display = []
            for direction in directions:
                # 根据方向名称设置显示符号
                if direction == "up_left":
                    symbol = "↖"
                elif direction == "up_right":
                    symbol = "↗"
                elif direction == "left":
                    symbol = "←"
                elif direction == "right":
                    symbol = "→"
                elif direction == "down_left":
                    symbol = "↙"
                elif direction == "down":
                    symbol = "↓"
                elif direction == "down_right":
                    symbol = "↘"
                else:
                    symbol = direction  # 使用原始名称作为显示
                
                direction_display.append((symbol, direction))
            
            # 添加中心点
            direction_display.append(("●", None))
            
            self._update_direction_buttons(direction_display)

    def update_tools_display(self, sprite_type: str):
        """更新工具显示"""
        # 隐藏所有工具框架
        if hasattr(self, 'map_tools_frame'):
            self.map_tools_frame.pack_forget()
        if hasattr(self, 'sprite_tools_frame'):
            self.sprite_tools_frame.pack_forget()
        if hasattr(self, 'tools_notebook'):
            self.tools_notebook.pack_forget()
        if hasattr(self, 'retained_notebook'):
            self.retained_notebook.pack_forget()
        if hasattr(self, 'map_tools_standalone_frame'):
            self.map_tools_standalone_frame.pack_forget()

        if sprite_type in ["map", "h5_map"]:
            # 隐藏精灵相关的工具栏
            if hasattr(self, 'action_frame'):
                self.action_frame.pack_forget()
            if hasattr(self, 'direction_frame'):
                self.direction_frame.pack_forget()
            if hasattr(self, 'animation_offset_notebook'):
                self.animation_offset_notebook.pack_forget()
            
            # 隐藏通用工具框架（包含重置偏移和导出当前帧按钮）
            if hasattr(self, 'common_btn_frame'):
                self.common_btn_frame.pack_forget()
            
            # 显示独立的地图工具框架
            if hasattr(self, 'map_tools_standalone_frame'):
                self.map_tools_standalone_frame.pack(pady=5, fill=tk.X, padx=10)
        else:
            # 显示精灵相关的工具栏 - 使用保存的引用来确保正确的显示顺序
            def show_sprite_components():
                # 显示动作选择框架 - 在ID选择之后
                if hasattr(self, 'action_frame'):
                    if not self.action_frame.winfo_ismapped():
                        # 在ID选择框架之后插入动作选择框架
                        self.action_frame.pack(pady=10, fill=tk.X, padx=10, after=self.id_frame)
                
                # 显示方向控制框架 - 在动作选择之后
                if hasattr(self, 'direction_frame'):
                    if not self.direction_frame.winfo_ismapped():
                        # 在动作选择框架之后插入方向控制框架
                        self.direction_frame.pack(pady=10, fill=tk.X, padx=10, after=self.action_frame)
                
                # 显示动画和偏移控制框架 - 在方向控制之后
                if hasattr(self, 'animation_offset_notebook'):
                    if not self.animation_offset_notebook.winfo_ismapped():
                        # 在方向控制框架之后插入动画偏移控制框架
                        self.animation_offset_notebook.pack(fill=tk.X, pady=5, padx=10, after=self.direction_frame)
                
                # 显示工具tab - 在动画偏移控制之后
                if hasattr(self, 'tools_notebook'):
                    if not self.tools_notebook.winfo_ismapped():
                        # 在动画偏移控制框架之后插入工具tab
                        self.tools_notebook.pack(fill=tk.X, pady=5, padx=10, after=self.animation_offset_notebook)
                
                # 显示保留素材管理tab - 在工具tab之后
                if hasattr(self, 'retained_notebook'):
                    if not self.retained_notebook.winfo_ismapped():
                        # 在工具tab之后插入保留素材管理tab
                        self.retained_notebook.pack(fill=tk.X, pady=5, padx=10, after=self.tools_notebook)
                
                # 重新显示通用工具框架 - 在保留素材管理之后
                if hasattr(self, 'common_btn_frame'):
                    if not self.common_btn_frame.winfo_ismapped():
                        # 在保留素材管理tab之后插入通用工具框架
                        try:
                            self.common_btn_frame.pack(fill=tk.X, pady=2, after=self.retained_notebook)
                        except tk.TclError:
                            # 如果after参数有问题，直接pack
                            self.common_btn_frame.pack(fill=tk.X, pady=2)
            
            # 使用after_idle确保UI布局完成后再显示组件
            self.root.after_idle(show_sprite_components)
            
            # 延迟更新画布，确保UI布局完成后再重新绘制
            self.root.after_idle(self._redraw_if_needed)
    
    def _redraw_if_needed(self):
        """如果需要，重新绘制画布内容"""
        # 这个方法可以在UI布局完成后被调用来重新绘制内容
        # 目前暂时为空，因为画布内容应该在显示时已经绘制好了
        pass

    def update_info(self, text: str):
        """更新信息标签"""
        if self.info_label:
            self.info_label.config(text=text)

    def update_play_button(self, is_playing: bool):
        """更新播放按钮"""
        if self.play_button:
            self.play_button.config(text="暂停" if is_playing else "播放")

    def reset_offset_controls(self):
        """重置偏移控制"""
        self.offset_x_var.set(0)
        self.offset_y_var.set(0)

    def clear_canvas(self):
        """清除画布"""
        if self.canvas:
            self.canvas.delete("all")

    def get_canvas_size(self) -> Tuple[int, int]:
        """获取画布尺寸"""
        if self.canvas:
            width = self.canvas.winfo_width()
            height = self.canvas.winfo_height()
            if width <= 1 or height <= 1:
                return 800, 600
            return width, height
        return 800, 600

    def draw_image_on_canvas(self, image, x: int, y: int, reference_lines=None, background_info=None):
        """在画布上绘制图像"""
        if self.canvas:
            # 清除画布
            self.canvas.delete("all")
            
            # 绘制背景
            if background_info:
                self._draw_background(background_info)
            
            # 绘制主图像
            self.canvas.create_image(x, y, image=image, anchor=tk.CENTER)
            
            # 绘制参考线
            if reference_lines:
                self._draw_reference_lines(reference_lines)
            
            # 强制更新画布
            self.canvas.update()
    
    def _draw_background(self, background_info):
        """绘制背景"""
        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()
        
        if background_info["type"] == "color":
            # 绘制颜色背景
            self.canvas.create_rectangle(0, 0, canvas_width, canvas_height, 
                                       fill=background_info["color"], outline="")
        elif background_info["type"] == "image" and background_info["image"]:
            # 绘制图片背景
            bg_image = background_info["image"]
            # 这里需要将PIL图像转换为Tkinter图像
            # 暂时跳过图片背景的实现
    
    def _draw_reference_lines(self, lines):
        """绘制参考线"""
        for line in lines:
            x1, y1, x2, y2 = line
            self.canvas.create_line(x1, y1, x2, y2, fill="red", width=1, dash=(5, 5))

    def _on_toggle_reference_lines(self):
        """切换参考线显示事件"""
        if self.controller:
            self.controller.on_toggle_reference_lines()

    def _on_set_background_color(self):
        """设置背景颜色事件"""
        if self.controller:
            self.controller.on_set_background_color()

    def _on_set_transparent_background(self):
        """设置透明背景事件"""
        if self.controller:
            self.controller.on_set_transparent_background()

    def _on_split_current_sprite(self):
        """拆图当前ID事件"""
        if self.controller:
            self.controller.on_split_current_sprite()

    def _on_split_all_sprites(self):
        """拆图所有ID事件"""
        if self.controller:
            self.controller.on_split_all_sprites()

    def _on_retain_current_sprite(self):
        """保留当前素材事件"""
        if self.controller:
            self.controller.on_retain_current_sprite()

    def _on_clear_all_retained(self):
        """清除所有保留素材事件"""
        if self.controller:
            self.controller.on_clear_all_retained()

    def _on_import_selected_sprite(self):
        """引入选中素材事件"""
        if self.controller:
            self.controller.on_import_selected_sprite()

    def _on_remove_selected_sprite(self):
        """移除选中素材事件"""
        if self.controller:
            self.controller.on_remove_selected_sprite()

    def _on_toggle_selected_visibility(self):
        """切换选中素材可见性事件"""
        if self.controller:
            self.controller.on_toggle_selected_visibility()

    def update_retained_sprites_list(self, retained_sprites):
        """更新保留素材列表"""
        self.retained_listbox.delete(0, tk.END)
        for sprite in retained_sprites:
            status = "✓" if sprite.visible else "✗"
            self.retained_listbox.insert(tk.END, f"{status} {sprite.name}")

    def get_selected_retained_sprite_index(self):
        """获取选中的保留素材索引"""
        selection = self.retained_listbox.curselection()
        return selection[0] if selection else -1

    def _on_select_resource_file(self):
        """选择资源 JSON 文件"""
        filetypes = [
            ("JSON 文件", "*.json"),
            ("所有文件", "*.*")
        ]
        filepath = filedialog.askopenfilename(
            title="选择包含帧信息的 JSON 文件",
            filetypes=filetypes
        )
        if filepath:
            self.selected_resource_path = filepath
            self.split_status_label.configure(text=f"已选择: {os.path.basename(filepath)}", foreground="blue")
        else:
            self.split_status_label.configure(text="等待选择文件...", foreground="gray")

    def _on_execute_image_split(self):
        """执行拆图"""
        if not self.selected_resource_path:
            messagebox.showwarning("拆图工具", "请先选择 JSON 资源文件！")
            return
        try:
            results = ImageSplitter.split(self.selected_resource_path)
            count = len(results)
            if count:
                self.split_status_label.configure(text=f"拆图完成，共 {count} 张", foreground="green")
                messagebox.showinfo("拆图工具", f"拆图完成，共生成 {count} 张图片！")
            else:
                self.split_status_label.configure(text="未生成任何图片", foreground="orange")
        except Exception as e:
            self.logger.log(f"拆图失败: {e}", "ERROR")
            self.split_status_label.configure(text="拆图失败，请查看日志", foreground="red")
            messagebox.showerror("拆图工具", f"拆图失败:\n{e}")