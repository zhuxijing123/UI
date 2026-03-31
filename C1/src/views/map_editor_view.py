# src/views/map_editor_view.py - 地图编辑器窗口
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from PIL import Image, ImageTk, ImageDraw
import os
import json
import math
import time


class MapEditorView:
    """地图编辑器窗口"""
    
    def __init__(self, root, map_data, config_manager):
        self.root = root
        self.map_data = map_data
        self.config_manager = config_manager
        
        self.window = None
        self.canvas = None
        self.original_image = None
        self.edited_image = None
        self.cell_size = (32, 32)  # 默认格子大小
        self.current_tool = "walkable"  # walkable, blocked, masked
        self.zoom_level = 1.0
        
        # 撤销重做系统
        self.undo_stack = []
        self.redo_stack = []
        self.max_undo_steps = 50
        
        # 重新设计的标记系统 - 简化高效
        self.is_marking = False
        self.last_mark_pos = None
        self.marked_cells = set()  # 记录本次标记中已处理的格子
        self.current_mark_batch = []  # 当前标记批次
        self.mark_update_timer = None
        
        # 显示更新优化
        self.display_update_timer = None
        self.display_update_interval = 300  # 300ms更新一次显示（进一步优化）
        self.pending_display_update = False
        self.last_display_update = 0  # 记录上次更新时间
        self.min_display_interval = 150  # 最小显示间隔150ms（进一步优化）
        
        # 性能优化缓存
        self.cell_width_cache = None
        self.cell_height_cache = None
        self.zoom_level_cache = None
        
        # 创建编辑器窗口
        self.create_window()
        
        # 加载地图数据
        self.load_map_data()
    
    def create_window(self):
        """创建编辑器窗口"""
        self.window = tk.Toplevel(self.root)
        self.window.title("地图编辑器")
        self.window.geometry("1200x800")
        
        # 创建主框架
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 创建工具栏
        self.create_toolbar(main_frame)
        
        # 创建编辑区域
        self.create_edit_area(main_frame)
        
        # 创建状态栏
        self.create_status_bar(main_frame)
    
    def create_toolbar(self, parent):
        """创建工具栏"""
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        # 工具选择
        tool_frame = ttk.LabelFrame(toolbar, text="编辑工具")
        tool_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        self.tool_var = tk.StringVar(value="walkable")
        ttk.Radiobutton(tool_frame, text="可通行", variable=self.tool_var, 
                       value="walkable", command=self.on_tool_changed).pack(side=tk.LEFT, padx=5)
        ttk.Radiobutton(tool_frame, text="不可通行", variable=self.tool_var, 
                       value="blocked", command=self.on_tool_changed).pack(side=tk.LEFT, padx=5)
        ttk.Radiobutton(tool_frame, text="遮罩", variable=self.tool_var, 
                       value="masked", command=self.on_tool_changed).pack(side=tk.LEFT, padx=5)
        
        # 缩放控制
        zoom_frame = ttk.LabelFrame(toolbar, text="缩放")
        zoom_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Button(zoom_frame, text="放大", command=self.zoom_in).pack(side=tk.LEFT, padx=2)
        ttk.Button(zoom_frame, text="缩小", command=self.zoom_out).pack(side=tk.LEFT, padx=2)
        ttk.Button(zoom_frame, text="适应窗口", command=self.fit_to_window).pack(side=tk.LEFT, padx=2)
        
        # 操作按钮
        action_frame = ttk.LabelFrame(toolbar, text="操作")
        action_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Button(action_frame, text="保存", command=self.save_map).pack(side=tk.LEFT, padx=2)
        ttk.Button(action_frame, text="另存为", command=self.save_as).pack(side=tk.LEFT, padx=2)
        ttk.Button(action_frame, text="撤销", command=self.undo).pack(side=tk.LEFT, padx=2)
        ttk.Button(action_frame, text="重做", command=self.redo).pack(side=tk.LEFT, padx=2)
        
        # 显示选项
        display_frame = ttk.LabelFrame(toolbar, text="显示")
        display_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        self.show_walkable_var = tk.BooleanVar(value=True)
        self.show_blocked_var = tk.BooleanVar(value=True)
        self.show_masked_var = tk.BooleanVar(value=True)
        
        ttk.Checkbutton(display_frame, text="可通行", variable=self.show_walkable_var, 
                       command=self.update_display).pack(side=tk.LEFT, padx=2)
        ttk.Checkbutton(display_frame, text="不可通行", variable=self.show_blocked_var, 
                       command=self.update_display).pack(side=tk.LEFT, padx=2)
        ttk.Checkbutton(display_frame, text="遮罩", variable=self.show_masked_var, 
                       command=self.update_display).pack(side=tk.LEFT, padx=2)
        
        # 范围设置
        range_frame = ttk.LabelFrame(toolbar, text="标记范围")
        range_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Label(range_frame, text="范围:").pack(side=tk.LEFT, padx=(5, 2))
        self.range_var = tk.IntVar(value=1)
        range_spinbox = ttk.Spinbox(range_frame, from_=1, to=10, width=5, 
                                   textvariable=self.range_var, command=self.on_range_changed)
        range_spinbox.pack(side=tk.LEFT, padx=2)
        
        # 快速范围按钮
        ttk.Button(range_frame, text="1x1", command=lambda: self.set_range(1)).pack(side=tk.LEFT, padx=2)
        ttk.Button(range_frame, text="3x3", command=lambda: self.set_range(3)).pack(side=tk.LEFT, padx=2)
        ttk.Button(range_frame, text="5x5", command=lambda: self.set_range(5)).pack(side=tk.LEFT, padx=2)
    
    def create_edit_area(self, parent):
        """创建编辑区域"""
        edit_frame = ttk.Frame(parent)
        edit_frame.pack(fill=tk.BOTH, expand=True)
        
        # 创建画布
        self.canvas = tk.Canvas(edit_frame, bg="white")
        
        # 添加滚动条
        h_scrollbar = ttk.Scrollbar(edit_frame, orient=tk.HORIZONTAL, command=self.canvas.xview)
        v_scrollbar = ttk.Scrollbar(edit_frame, orient=tk.VERTICAL, command=self.canvas.yview)
        
        self.canvas.configure(xscrollcommand=h_scrollbar.set, yscrollcommand=v_scrollbar.set)
        
        # 布局
        self.canvas.grid(row=0, column=0, sticky="nsew")
        h_scrollbar.grid(row=1, column=0, sticky="ew")
        v_scrollbar.grid(row=0, column=1, sticky="ns")
        
        edit_frame.grid_rowconfigure(0, weight=1)
        edit_frame.grid_columnconfigure(0, weight=1)
        
        # 绑定事件 - 重新设计的实时标记
        self.canvas.bind("<Button-1>", self.on_canvas_press)
        self.canvas.bind("<B1-Motion>", self.on_canvas_motion)
        self.canvas.bind("<ButtonRelease-1>", self.on_canvas_release)
        self.canvas.bind("<MouseWheel>", self.on_mouse_wheel)
        
        # 鼠标移动事件（用于实时坐标显示）
        self.canvas.bind("<Motion>", self.on_canvas_motion_track)
    
    def create_status_bar(self, parent):
        """创建状态栏"""
        status_frame = ttk.Frame(parent)
        status_frame.pack(fill=tk.X, pady=(10, 0))
        
        self.status_label = ttk.Label(status_frame, text="就绪")
        self.status_label.pack(side=tk.LEFT)
        
        self.coord_label = ttk.Label(status_frame, text="坐标: (0, 0)")
        self.coord_label.pack(side=tk.RIGHT)
    
    def load_map_data(self):
        """加载地图数据"""
        if not self.map_data:
            messagebox.showerror("错误", "没有地图数据")
            return
        
        try:
            # 获取地图图像
            self.original_image = self.map_data.get_rendered_image(False, False, False)
            self.edited_image = self.original_image.copy()
            
            # 更新显示
            self.update_display()
            
            self.status_label.config(text=f"地图已加载: {self.map_data.width}x{self.map_data.height}")
            
        except Exception as e:
            messagebox.showerror("错误", f"加载地图失败: {e}")
    
    def update_display(self):
        """更新显示"""
        if not self.edited_image:
            return
        
        try:
            # 创建显示图像
            display_image = self.edited_image.copy()
            
            # 添加标记层
            if self.show_walkable_var.get() or self.show_blocked_var.get() or self.show_masked_var.get():
                draw = ImageDraw.Draw(display_image, 'RGBA')
                
                cell_width = display_image.width / self.map_data.width
                cell_height = display_image.height / self.map_data.height
                
                for y in range(self.map_data.height):
                    for x in range(self.map_data.width):
                        idx = y * self.map_data.width + x
                        if idx < len(self.map_data.cells):
                            cell_value = self.map_data.cells[idx]
                            
                            x1 = int(x * cell_width)
                            y1 = int(y * cell_height)
                            x2 = int((x + 1) * cell_width)
                            y2 = int((y + 1) * cell_height)
                            
                            # 获取配置的颜色和透明度
                            colors = self.config_manager.get_map_marker_colors()
                            alpha = int(self.config_manager.get_map_marker_alpha() * 255)
                            
                            if cell_value == 0 and self.show_walkable_var.get():  # WALKABLE
                                color = colors.get('walkable', '#00FF00')
                                rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))  # 转换#RRGGBB为RGB
                                draw.rectangle([x1, y1, x2, y2], fill=(*rgb, alpha))
                            elif cell_value == 1 and self.show_blocked_var.get():  # BLOCKED
                                color = colors.get('blocked', '#FF0000')
                                rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))  # 转换#RRGGBB为RGB
                                draw.rectangle([x1, y1, x2, y2], fill=(*rgb, alpha))
                            elif cell_value == 3 and self.show_masked_var.get():  # MASKED
                                color = colors.get('masked', '#0000FF')
                                rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))  # 转换#RRGGBB为RGB
                                draw.rectangle([x1, y1, x2, y2], fill=(*rgb, alpha))
            
            # 缩放图像
            if self.zoom_level != 1.0:
                new_width = int(display_image.width * self.zoom_level)
                new_height = int(display_image.height * self.zoom_level)
                display_image = display_image.resize((new_width, new_height), Image.LANCZOS)
            
            # 显示图像
            self.photo = ImageTk.PhotoImage(display_image)
            self.canvas.delete("all")
            self.canvas.create_image(0, 0, anchor="nw", image=self.photo)
            self.canvas.configure(scrollregion=self.canvas.bbox("all"))
            
        except Exception as e:
            print(f"更新显示失败: {e}")
    
    def on_tool_changed(self):
        """工具改变事件"""
        self.current_tool = self.tool_var.get()
        self.status_label.config(text=f"当前工具: {self.current_tool}")
    
    def on_range_changed(self):
        """范围改变事件"""
        range_value = self.range_var.get()
        self.status_label.config(text=f"标记范围: {range_value}x{range_value}")
    
    def set_range(self, value):
        """设置标记范围"""
        self.range_var.set(value)
        self.on_range_changed()
    
    def on_canvas_press(self, event):
        """画布鼠标按下事件 - 开始实时标记"""
        if not self.map_data:
            return
        
        # 开始实时标记
        self.is_marking = True
        self.marked_cells.clear()  # 清空本次标记的格子记录
        self.current_mark_batch.clear()
        
        # 记录起始位置
        self.last_mark_pos = (event.x, event.y)
        
        # 立即标记起始位置
        self._mark_at_position(event.x, event.y)
        
        self.status_label.config(text="开始实时标记")
    
    def on_canvas_motion(self, event):
        """画布鼠标移动事件 - 实时标记"""
        if not self.is_marking or not self.map_data:
            return
        
        current_pos = (event.x, event.y)
        
        # 检查位置是否发生变化
        if self.last_mark_pos != current_pos:
            # 获取鼠标轨迹上的所有点，确保连续标记
            self._mark_trajectory(self.last_mark_pos, current_pos)
            self.last_mark_pos = current_pos
    
    def _mark_trajectory(self, start_pos, end_pos):
        """标记鼠标轨迹上的所有点 - 优化版本"""
        if not start_pos:
            # 如果没有起始位置，只标记终点
            self._mark_at_position(end_pos[0], end_pos[1])
            return
        
        # 使用优化的Bresenham算法获取轨迹上的所有点
        trajectory_points = self._get_trajectory_points_optimized(start_pos, end_pos)
        
        # 批量标记轨迹上的所有点（减少函数调用开销）
        self._batch_mark_positions(trajectory_points)
    
    def _get_trajectory_points_optimized(self, start_pos, end_pos):
        """获取两点之间的轨迹点 - 优化版本"""
        x1, y1 = start_pos
        x2, y2 = end_pos
        
        # 快速检查是否为同一点
        if x1 == x2 and y1 == y2:
            return [(x1, y1)]
        
        points = []
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        
        # 确定步进方向
        step_x = 1 if x2 > x1 else -1
        step_y = 1 if y2 > y1 else -1
        
        # 选择主方向并优化算法
        if dx > dy:
            # X方向为主 - 优化版本
            error = 2 * dy - dx
            y = y1
            
            for x in range(x1, x2 + step_x, step_x):
                points.append((x, y))
                
                if error > 0:
                    y += step_y
                    error -= 2 * dx
                
                error += 2 * dy
        else:
            # Y方向为主 - 优化版本
            error = 2 * dx - dy
            x = x1
            
            for y in range(y1, y2 + step_y, step_y):
                points.append((x, y))
                
                if error > 0:
                    x += step_x
                    error -= 2 * dy
                
                error += 2 * dx
        
        return points
    
    def _batch_mark_positions(self, positions):
        """批量标记多个位置 - 减少函数调用开销"""
        if not positions:
            return
        
        # 使用缓存优化坐标转换
        if (self.cell_width_cache is None or 
            self.cell_height_cache is None or 
            self.zoom_level_cache != self.zoom_level):
            
            self.cell_width_cache = self.original_image.width / self.map_data.width
            self.cell_height_cache = self.original_image.height / self.map_data.height
            self.zoom_level_cache = self.zoom_level
        
        # 预计算常用值
        cell_width = self.cell_width_cache
        cell_height = self.cell_height_cache
        range_size = self.range_var.get()
        half_range = range_size // 2
        
        # 设置格子值
        new_value = 0
        if self.current_tool == "walkable":
            new_value = 0
        elif self.current_tool == "blocked":
            new_value = 1
        elif self.current_tool == "masked":
            new_value = 3
        
        # 批量处理所有位置
        for x, y in positions:
            # 转换坐标
            canvas_x = self.canvas.canvasx(x)
            canvas_y = self.canvas.canvasy(y)
            
            # 转换到图像坐标
            image_x = int(canvas_x / self.zoom_level)
            image_y = int(canvas_y / self.zoom_level)
            
            # 转换到格子坐标
            grid_x = int(image_x / cell_width)
            grid_y = int(image_y / cell_height)
            
            # 检查坐标是否在有效范围内
            if not (0 <= grid_x < self.map_data.width and 0 <= grid_y < self.map_data.height):
                continue
            
            # 计算范围边界
            start_x = max(0, grid_x - half_range)
            end_x = min(self.map_data.width, grid_x + half_range + 1)
            start_y = max(0, grid_y - half_range)
            end_y = min(self.map_data.height, grid_y + half_range + 1)
            
            # 处理范围内的格子
            for grid_y_pos in range(start_y, end_y):
                for grid_x_pos in range(start_x, end_x):
                    # 检查是否已经处理过这个格子
                    cell_key = (grid_x_pos, grid_y_pos)
                    if cell_key in self.marked_cells:
                        continue
                    
                    idx = grid_y_pos * self.map_data.width + grid_x_pos
                    old_value = self.map_data.cells[idx]
                    
                    # 如果值没有改变，跳过
                    if old_value == new_value:
                        continue
                    
                    # 记录撤销信息
                    self.current_mark_batch.append({
                        'x': grid_x_pos,
                        'y': grid_y_pos,
                        'old_value': old_value,
                        'new_value': new_value
                    })
                    
                    # 设置新值
                    self.map_data.cells[idx] = new_value
                    
                    # 标记为已处理
                    self.marked_cells.add(cell_key)
    
    def on_canvas_motion_track(self, event):
        """鼠标移动跟踪事件 - 仅用于坐标显示"""
        if not self.map_data:
            return
        
        # 转换坐标并显示
        canvas_x = self.canvas.canvasx(event.x)
        canvas_y = self.canvas.canvasy(event.y)
        
        # 转换到图像坐标
        image_x = int(canvas_x / self.zoom_level)
        image_y = int(canvas_y / self.zoom_level)
        
        # 转换到格子坐标
        cell_width = self.original_image.width / self.map_data.width
        cell_height = self.original_image.height / self.map_data.height
        
        grid_x = int(image_x / cell_width)
        grid_y = int(image_y / cell_height)
        
        # 检查坐标是否在有效范围内
        if 0 <= grid_x < self.map_data.width and 0 <= grid_y < self.map_data.height:
            self.coord_label.config(text=f"坐标: ({grid_x}, {grid_y})")
        else:
            self.coord_label.config(text=f"坐标: ({grid_x}, {grid_y}) [超出范围]")
    
    def on_canvas_release(self, event):
        """画布鼠标释放事件 - 结束实时标记"""
        if self.is_marking:
            # 强制立即更新显示（确保最终结果可见）
            if self.pending_display_update:
                if self.display_update_timer:
                    self.window.after_cancel(self.display_update_timer)
                self._delayed_update_display()
            else:
                # 如果没有待更新的显示，强制更新一次
                self.update_display()
            
            # 处理最后的标记批次
            self._commit_mark_batch()
            
            self.is_marking = False
            self.last_mark_pos = None
            self.marked_cells.clear()
            self.current_mark_batch.clear()
            
            self.status_label.config(text="实时标记结束")
    
    def _mark_at_position(self, x, y):
        """在指定位置进行标记 - 优化版本"""
        if not self.map_data:
            return
        
        # 使用缓存优化坐标转换
        if (self.cell_width_cache is None or 
            self.cell_height_cache is None or 
            self.zoom_level_cache != self.zoom_level):
            
            self.cell_width_cache = self.original_image.width / self.map_data.width
            self.cell_height_cache = self.original_image.height / self.map_data.height
            self.zoom_level_cache = self.zoom_level
        
        # 转换坐标
        canvas_x = self.canvas.canvasx(x)
        canvas_y = self.canvas.canvasy(y)
        
        # 转换到图像坐标
        image_x = int(canvas_x / self.zoom_level)
        image_y = int(canvas_y / self.zoom_level)
        
        # 转换到格子坐标
        cell_width = self.cell_width_cache
        cell_height = self.cell_height_cache
        
        grid_x = int(image_x / cell_width)
        grid_y = int(image_y / cell_height)
        
        # 检查坐标是否在有效范围内
        if not (0 <= grid_x < self.map_data.width and 0 <= grid_y < self.map_data.height):
            return
        
        # 获取当前范围
        range_size = self.range_var.get()
        
        # 计算范围边界
        half_range = range_size // 2
        start_x = max(0, grid_x - half_range)
        end_x = min(self.map_data.width, grid_x + half_range + 1)
        start_y = max(0, grid_y - half_range)
        end_y = min(self.map_data.height, grid_y + half_range + 1)
        
        # 设置格子值
        new_value = 0
        if self.current_tool == "walkable":
            new_value = 0
        elif self.current_tool == "blocked":
            new_value = 1
        elif self.current_tool == "masked":
            new_value = 3
        
        # 高效处理范围内的格子
        cells_changed = 0
        
        for grid_y_pos in range(start_y, end_y):
            for grid_x_pos in range(start_x, end_x):
                # 检查是否已经处理过这个格子
                cell_key = (grid_x_pos, grid_y_pos)
                if cell_key in self.marked_cells:
                    continue
                
                idx = grid_y_pos * self.map_data.width + grid_x_pos
                old_value = self.map_data.cells[idx]
                
                # 如果值没有改变，跳过
                if old_value == new_value:
                    continue
                
                # 记录撤销信息
                self.current_mark_batch.append({
                    'x': grid_x_pos,
                    'y': grid_y_pos,
                    'old_value': old_value,
                    'new_value': new_value
                })
                
                # 设置新值
                self.map_data.cells[idx] = new_value
                cells_changed += 1
                
                # 标记为已处理
                self.marked_cells.add(cell_key)
        
        # 如果有格子被修改，启动延迟显示更新
        if cells_changed > 0:
            # 启动延迟显示更新（减少更新频率）
            self._schedule_display_update()
    
    def _schedule_display_update(self):
        """调度显示更新 - 优化版本"""
        current_time = time.time() * 1000  # 转换为毫秒
        
        # 检查是否距离上次更新太近
        if current_time - self.last_display_update < self.min_display_interval:
            # 如果距离上次更新太近，延长等待时间
            if not self.pending_display_update:
                self.pending_display_update = True
                if self.display_update_timer:
                    self.window.after_cancel(self.display_update_timer)
                
                # 计算剩余等待时间
                remaining_time = self.min_display_interval - (current_time - self.last_display_update)
                self.display_update_timer = self.window.after(
                    int(remaining_time), 
                    self._delayed_update_display
                )
        else:
            # 如果距离上次更新足够远，立即更新
            if not self.pending_display_update:
                self.pending_display_update = True
                if self.display_update_timer:
                    self.window.after_cancel(self.display_update_timer)
                
                self.display_update_timer = self.window.after(
                    self.display_update_interval, 
                    self._delayed_update_display
                )
    
    def _delayed_update_display(self):
        """延迟更新显示 - 优化版本"""
        self.display_update_timer = None
        self.pending_display_update = False
        self.last_display_update = time.time() * 1000  # 记录更新时间
        
        self.update_display()
        
        self.status_label.config(text=f"实时标记: {len(self.current_mark_batch)} 个格子")
    
    def _commit_mark_batch(self):
        """提交标记批次到撤销栈"""
        if not self.current_mark_batch:
            return
        
        # 记录批量撤销信息
        self.undo_stack.append({
            'type': 'batch',
            'changes': self.current_mark_batch.copy()
        })
        
        # 限制撤销栈大小
        if len(self.undo_stack) > self.max_undo_steps:
            self.undo_stack.pop(0)
        
        # 清空重做栈
        self.redo_stack.clear()
        
        # 清空当前批次
        self.current_mark_batch.clear()
    
    def on_mouse_wheel(self, event):
        """鼠标滚轮事件"""
        if event.delta > 0:
            self.zoom_in()
        else:
            self.zoom_out()
    
    def zoom_in(self):
        """放大"""
        self.zoom_level = min(self.zoom_level * 1.2, 5.0)
        self.update_display()
    
    def zoom_out(self):
        """缩小"""
        self.zoom_level = max(self.zoom_level / 1.2, 0.1)
        self.update_display()
    
    def fit_to_window(self):
        """适应窗口"""
        if not self.edited_image:
            return
        
        # 获取画布大小
        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()
        
        if canvas_width <= 1 or canvas_height <= 1:
            return
        
        # 计算缩放比例
        scale_x = canvas_width / self.edited_image.width
        scale_y = canvas_height / self.edited_image.height
        self.zoom_level = min(scale_x, scale_y, 1.0)
        
        self.update_display()
    
    def save_map(self):
        """保存地图"""
        if not self.map_data:
            return
        
        try:
            # 保存到原文件
            map_file = self.map_data.map_file
            if map_file and os.path.exists(map_file):
                with open(map_file, 'w', encoding='utf-8') as f:
                    json.dump({
                        'width': self.map_data.width,
                        'height': self.map_data.height,
                        'cells': self.map_data.cells
                    }, f, indent=2)
                
                self.status_label.config(text="地图已保存")
                messagebox.showinfo("成功", "地图已保存")
            else:
                self.save_as()
                
        except Exception as e:
            messagebox.showerror("错误", f"保存地图失败: {e}")
    
    def save_as(self):
        """另存为"""
        if not self.map_data:
            return
        
        try:
            # 获取原文件名（不含扩展名）
            original_name = os.path.splitext(os.path.basename(self.map_data.map_file))[0] if self.map_data.map_file else "map"
            new_name = f"{original_name}_newmap"
            
            # 创建导出目录
            import os
            main_dir = os.path.dirname(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
            export_dir = os.path.join(main_dir, "导出", "地图编辑器")
            os.makedirs(export_dir, exist_ok=True)
            
            # 创建地图文件夹
            map_folder = os.path.join(export_dir, new_name)
            os.makedirs(map_folder, exist_ok=True)
            
            # 保存JSON文件
            json_file = os.path.join(export_dir, f"{new_name}.json")
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'width': self.map_data.width,
                    'height': self.map_data.height,
                    'cells': self.map_data.cells
                }, f, indent=2)
            
            # 切割并保存地图碎片
            self._save_map_tiles(map_folder, new_name)
            
            self.status_label.config(text=f"地图已保存到: {json_file}")
            messagebox.showinfo("成功", f"地图已保存到:\nJSON: {json_file}\n碎片: {map_folder}")
            
        except Exception as e:
            messagebox.showerror("错误", f"保存地图失败: {e}")
    
    def _save_map_tiles(self, folder_path, base_name):
        """保存地图碎片"""
        try:
            # 获取地图图像
            map_image = self.map_data.get_rendered_image(False, False, False)
            
            # 切割参数
            tile_size = 512
            map_width, map_height = map_image.size
            
            # 计算需要多少个碎片
            cols = (map_width + tile_size - 1) // tile_size
            rows = (map_height + tile_size - 1) // tile_size
            
            for row in range(rows):
                for col in range(cols):
                    # 计算碎片位置
                    x = col * tile_size
                    y = row * tile_size
                    
                    # 计算碎片大小
                    tile_width = min(tile_size, map_width - x)
                    tile_height = min(tile_size, map_height - y)
                    
                    # 切割碎片
                    tile = map_image.crop((x, y, x + tile_width, y + tile_height))
                    
                    # 保存碎片
                    tile_name = f"{base_name}_r{row+1}_c{col+1}.jpg"
                    tile_path = os.path.join(folder_path, tile_name)
                    tile.save(tile_path, "JPEG", quality=95)
            
        except Exception as e:
            print(f"保存地图碎片失败: {e}")
    
    def undo(self):
        """撤销"""
        if not self.undo_stack:
            self.status_label.config(text="没有可撤销的操作")
            return
        
        # 获取最后一个撤销信息
        undo_info = self.undo_stack.pop()
        
        if undo_info.get('type') == 'batch':
            # 批量撤销
            redo_batch = []
            for change in undo_info['changes']:
                idx = change['y'] * self.map_data.width + change['x']
                current_value = self.map_data.cells[idx]
                
                redo_batch.append({
                    'x': change['x'],
                    'y': change['y'],
                    'old_value': current_value,
                    'new_value': change['old_value']
                })
                
                # 恢复旧值
                self.map_data.cells[idx] = change['old_value']
            
            # 记录批量重做信息
            self.redo_stack.append({
                'type': 'batch',
                'changes': redo_batch
            })
            
            self.status_label.config(text=f"已撤销 {len(undo_info['changes'])} 个格子的修改")
        else:
            # 单个撤销
            idx = undo_info['y'] * self.map_data.width + undo_info['x']
            current_value = self.map_data.cells[idx]
            
            self.redo_stack.append({
                'x': undo_info['x'],
                'y': undo_info['y'],
                'old_value': current_value,
                'new_value': undo_info['old_value']
            })
            
            # 恢复旧值
            self.map_data.cells[idx] = undo_info['old_value']
            
            self.status_label.config(text=f"已撤销格子 ({undo_info['x']}, {undo_info['y']})")
        
        # 更新显示
        self.update_display()
    
    def redo(self):
        """重做"""
        if not self.redo_stack:
            self.status_label.config(text="没有可重做的操作")
            return
        
        # 获取最后一个重做信息
        redo_info = self.redo_stack.pop()
        
        if redo_info.get('type') == 'batch':
            # 批量重做
            undo_batch = []
            for change in redo_info['changes']:
                idx = change['y'] * self.map_data.width + change['x']
                current_value = self.map_data.cells[idx]
                
                undo_batch.append({
                    'x': change['x'],
                    'y': change['y'],
                    'old_value': current_value,
                    'new_value': change['new_value']
                })
                
                # 应用新值
                self.map_data.cells[idx] = change['new_value']
            
            # 记录批量撤销信息
            self.undo_stack.append({
                'type': 'batch',
                'changes': undo_batch
            })
            
            self.status_label.config(text=f"已重做 {len(redo_info['changes'])} 个格子的修改")
        else:
            # 单个重做
            idx = redo_info['y'] * self.map_data.width + redo_info['x']
            current_value = self.map_data.cells[idx]
            
            # 记录撤销信息（用于下次撤销）
            self.undo_stack.append({
                'x': redo_info['x'],
                'y': redo_info['y'],
                'old_value': current_value,
                'new_value': redo_info['new_value']
            })
            
            # 应用新值（重做时应该应用new_value）
            self.map_data.cells[idx] = redo_info['new_value']
            
            self.status_label.config(text=f"已重做格子 ({redo_info['x']}, {redo_info['y']})")
        
        # 更新显示
        self.update_display()
    
    def show(self):
        """显示编辑器窗口"""
        if self.window and self.window.winfo_exists():
            try:
                self.window.deiconify()
                self.window.lift()
            except tk.TclError:
                # 如果窗口已销毁，重新创建
                self.create_window()
                self.load_map_data()
        else:
            # 如果窗口不存在，重新创建
            self.create_window()
            self.load_map_data()
    
    def hide(self):
        """隐藏编辑器窗口"""
        if self.window:
            self.window.withdraw()
    
    def destroy(self):
        """销毁编辑器窗口"""
        if self.window:
            self.window.destroy()
            self.window = None 