# src/controllers/main_controller.py - 完整修复版本
import tkinter as tk
from tkinter import filedialog, messagebox
from typing import Optional
from ..models.sprite_manager import SpriteManager
from ..models.sprite_types import SpriteType, ActionType, DirectionType
from ..views.main_view import MainView
from ..utils.logger import Logger
from ..utils.animation_controller import AnimationController
from ..utils.canvas_manager import CanvasManager


class MainController:
    """主控制器类 - 协调模型和视图"""

    def __init__(self, sprite_manager: SpriteManager, main_view: MainView, logger: Logger,
                 config_manager=None, memory_manager=None, image_optimizer=None, 
                 plugin_manager=None, state_manager=None):
        self.sprite_manager = sprite_manager
        self.main_view = main_view
        self.logger = logger
        self.config_manager = config_manager
        self.memory_manager = memory_manager
        self.image_optimizer = image_optimizer
        self.plugin_manager = plugin_manager
        self.state_manager = state_manager

        # 动画控制器
        self.animation_controller = AnimationController(self.logger)
        self.animation_controller.set_frame_callback(self._on_animation_frame)

        # 画布管理器
        self.canvas_manager = CanvasManager(self.logger)
        
        # 保留素材管理器
        from ..models.retained_sprite import RetainedSpriteManager
        self.retained_sprite_manager = RetainedSpriteManager(self.logger)
        
        # 线程管理器
        from ..utils.thread_manager import ThreadManager, AsyncLoader
        self.thread_manager = ThreadManager(self.logger)
        self.async_loader = AsyncLoader(self.thread_manager, self.logger)

        # 当前状态
        self.current_sprite_type = "scene"
        self.current_subtype = ""
        self.current_offset = [0, 0]

        # 初始化
        self._initialize()

    def _initialize(self):
        """初始化控制器"""
        self._update_actions_display()
        self._update_tools_display()
        
        # 启动线程结果处理
        self._schedule_thread_processing()
        
        # 使用after_idle确保UI完全初始化后再执行
        self.main_view.root.after_idle(self._delayed_initialization)
        
        self.logger.log("控制器初始化完成", "INFO")
    
    def _delayed_initialization(self):
        """延迟初始化，确保UI完全准备好"""
        # 确保UI状态正确初始化
        self._ensure_ui_initialization()
        
        # 恢复保存的状态
        self._restore_saved_state()
        
        self.logger.log("延迟初始化完成", "INFO")
    
    def _restore_saved_state(self):
        """恢复保存的状态"""
        if self.state_manager:
            try:
                state = self.state_manager.get_state()
                if state.current_sprite_type:
                    print(f"MainController: 恢复保存的状态，素材类型: {state.current_sprite_type}")
                    self.logger.log(f"恢复保存的状态，素材类型: {state.current_sprite_type}", "INFO")
                    
                    # 设置当前状态
                    self.current_sprite_type = state.current_sprite_type
                    self.current_subtype = getattr(state, 'current_subtype', '')
                    
                    # 更新UI
                    self.main_view.sprite_type_var.set(state.current_sprite_type)
                    
                    # 触发素材类型变更事件
                    self.on_sprite_type_changed(state.current_sprite_type)
                    
                    # 如果有保存的素材ID，尝试加载
                    if state.current_sprite_id:
                        print(f"MainController: 尝试加载保存的素材ID: {state.current_sprite_id}")
                        self._load_saved_sprite(state.current_sprite_id)
                    
                    return
            except Exception as e:
                print(f"MainController: 恢复状态失败: {e}")
                self.logger.log(f"恢复状态失败: {e}", "ERROR")
        
        # 如果恢复失败，使用默认的scene类型
        print(f"MainController: 使用默认素材类型: scene")
        self.on_sprite_type_changed("scene")
    
    def _load_saved_sprite(self, sprite_id: str):
        """加载保存的素材"""
        try:
            if self.current_sprite_type == "h5_map":
                print(f"MainController: 开始加载保存的H5地图: {sprite_id}")
                self.load_sprite_async(sprite_id)
            else:
                # 其他类型的素材加载逻辑
                self.load_sprite_async(sprite_id)
        except Exception as e:
            print(f"MainController: 加载保存的素材失败: {e}")
            self.logger.log(f"加载保存的素材失败: {e}", "ERROR")
    
    def _ensure_ui_initialization(self):
        """确保UI正确初始化"""
        # 确保场景类型被正确设置
        if self.main_view.sprite_type_var.get() != "scene":
            self.main_view.sprite_type_var.set("scene")
        
        # 确保子类型框架显示
        if not self.main_view.subtype_frame.winfo_ismapped():
            self.main_view.subtype_frame.pack(pady=5, fill=tk.X, padx=10)
        
        # 强制更新UI以确保框架被正确显示
        self.main_view.root.update()
        
        # 确保工具显示正确
        self._update_tools_display()
        
        self.logger.log("UI初始化完成", "INFO")
    
    def _schedule_thread_processing(self):
        """定期处理线程结果"""
        self.thread_manager.process_results()
        # 每100ms处理一次线程结果
        self.main_view.root.after(100, self._schedule_thread_processing)

    def _on_animation_frame(self):
        """动画帧回调"""
        sprite_data = self.sprite_manager.get_current_sprite_data()
        if sprite_data and not sprite_data.is_simple_images():
            # 只有非简单图片才进行帧切换
            sprite_data.next_frame()
            
            # 同步保留素材的动画
            current_direction = sprite_data.current_direction
            current_action = sprite_data.current_action
            is_playing = self.animation_controller.is_playing()
            current_frame = sprite_data.current_frame
            
            self.retained_sprite_manager.sync_all_sprites(current_direction, current_action, is_playing, current_frame)
            
            # 只更新画布显示，不更新整个UI
            self.main_view.root.after_idle(self._update_sprite_display_only)

    # 事件处理方法
    def on_sprite_type_changed(self, sprite_type: str):
        """处理素材类型改变"""
        self.current_sprite_type = sprite_type
        self.current_subtype = ""
        self.logger.log(f"素材类型切换为: {sprite_type}", "INFO")

        # 更新状态管理器
        if self.state_manager:
            self.state_manager.set_current_sprite(sprite_type, "")

        # 停止动画
        self.animation_controller.stop()
        self.main_view.update_play_button(False)

        # 清除显示和缓存
        self._clear_display()
        self._clear_cache()
        
        # 更新子类型列表
        if sprite_type == "scene":
            # 确保子类型选择框架显示
            if not self.main_view.subtype_frame.winfo_ismapped():
                self.main_view.subtype_frame.pack(pady=5, fill=tk.X, padx=10)
            self._update_scene_subtypes()
        elif sprite_type in ["map", "h5_map"]:
            # 隐藏子类型选择，显示地图列表
            self.main_view.subtype_frame.pack_forget()
            self._update_map_list()

        # 更新UI - 强制更新所有UI组件
        self._force_update_ui()
    
    def _force_update_ui(self):
        """强制更新所有UI组件"""
        # 先更新工具显示，确保框架正确显示
        self._update_tools_display()
        
        # 再更新动作显示，根据素材类型决定是否显示方向控制
        self._update_actions_display()
        
        # 强制更新UI，确保所有组件正确显示
        self.main_view.root.update()
    
    def _update_ui_for_simple_image(self):
        """为简单图片更新UI，避免清除画布内容"""
        # 只更新工具显示，不强制更新整个UI
        self._update_tools_display()
        self._update_actions_display()

    def on_folder_selected(self, folder_path: str):
        """处理文件夹选择"""
        if self.sprite_manager.set_base_path(folder_path):
            self.main_view.update_info(f"素材路径: {folder_path}")
            self._refresh_sprite_ids()
        else:
            messagebox.showerror("错误", "无效的文件夹路径")

    def on_sprite_id_changed(self, sprite_id: str):
        """处理精灵ID改变"""
        # 更新状态管理器
        if self.state_manager:
            self.state_manager.set_current_sprite(self.current_sprite_type, sprite_id)
        
        # 使用异步加载
        def load_callback(result, error):
            print(f"MainController: 收到加载回调 - 结果: {result is not None}, 错误: {error}")
            self.logger.log(f"Controller: 收到加载回调 - 结果: {result is not None}, 错误: {error}", "INFO")
            
            if error:
                print(f"MainController: 加载失败: {sprite_id}, 错误: {error}")
                self.logger.log(f"Controller: 加载失败: {sprite_id}, 错误: {error}", "ERROR")
                messagebox.showerror("错误", f"加载精灵失败: {sprite_id}\n{error}")
            elif result:
                print(f"MainController: 加载成功: {sprite_id}, 开始更新显示")
                self.logger.log(f"Controller: 加载成功: {sprite_id}, 开始更新显示", "INFO")
                self._update_display()
                
                # 检查是否为简单图片类型
                sprite_data = self.sprite_manager.get_current_sprite_data()
                if sprite_data and sprite_data.is_simple_images():
                    # 对于简单图片，延迟更新UI，确保图片先显示
                    self.logger.log("Controller: 检测到简单图片，延迟更新UI", "INFO")
                    self.main_view.root.after(50, self._update_ui_for_simple_image)
                else:
                    # 对于其他类型，强制更新UI状态
                    self.logger.log("Controller: 强制更新UI状态", "INFO")
                    self._force_update_ui()
                
                # 如果是地图类型，自动自适应
                if self.current_sprite_type in ["map", "h5_map"]:
                    self.logger.log("Controller: 地图类型，执行自适应", "INFO")
                    self.main_view.root.after(100, self.on_map_fit)
            else:
                self.logger.log(f"Controller: 加载返回空结果: {sprite_id}", "ERROR")
                messagebox.showerror("错误", f"加载精灵失败: {sprite_id}")

        if self.current_sprite_type == "map":
            self.async_loader.load_sprite_async(
                self.sprite_manager, 
                "map", 
                None, 
                sprite_id, 
                load_callback
            )
        elif self.current_sprite_type == "h5_map":
            print(f"MainController: 准备异步加载H5地图，ID: {sprite_id}")
            self.logger.log(f"开始异步加载H5地图: {sprite_id}", "INFO")
            self.async_loader.load_h5_map_async(
                self.sprite_manager,
                sprite_id,
                load_callback
            )
            print(f"MainController: H5地图异步加载请求已发送")
        elif self.current_sprite_type == "scene" and self.current_subtype:
            self.async_loader.load_sprite_async(
                self.sprite_manager, 
                "scene", 
                self.current_subtype, 
                sprite_id, 
                load_callback
            )

    def on_refresh_ids(self):
        """处理刷新ID列表"""
        try:
            self._refresh_sprite_ids()
            
            # 获取当前ID列表
            if self.current_sprite_type == "map":
                ids = self.sprite_manager.get_sprite_ids("map")
            elif self.current_sprite_type == "scene" and self.current_subtype:
                ids = self.sprite_manager.get_sprite_ids("scene", self.current_subtype)
            else:
                ids = []
            
            if ids:
                first_id = ids[0]
                self.main_view.sprite_id_var.set(first_id)
                # 延迟加载，确保UI更新完成
                self.main_view.root.after(100, lambda: self.on_sprite_id_changed(first_id))
                
        except Exception as e:
            self.logger.log(f"刷新ID列表失败: {e}", "ERROR")

    def on_action_changed(self, action: str):
        """处理动作改变"""
        sprite_data = self.sprite_manager.get_current_sprite_data()
        if sprite_data and not sprite_data.is_simple_images():
            # 更新当前动作
            sprite_data.set_current_action(action)
            
            # 同步保留素材的动作
            current_direction = sprite_data.current_direction
            is_playing = self.animation_controller.is_playing()
            current_frame = sprite_data.current_frame
            
            self.retained_sprite_manager.sync_all_sprites(current_direction, action, is_playing, current_frame)
            
            # 更新显示
            self._update_sprite_display()
            self.logger.log(f"动作切换为: {action}", "INFO")

    def on_direction_changed(self, direction: str):
        """处理方向改变"""
        sprite_data = self.sprite_manager.get_current_sprite_data()
        if sprite_data:
            sprite_data.set_direction(direction)
            
            # 同步保留素材的方向
            current_action = sprite_data.current_action
            self.retained_sprite_manager.sync_all_sprites(direction, current_action, self.animation_controller.is_playing(), 0)
            
            self._update_sprite_display()
            self.logger.log(f"方向切换为: {direction}", "INFO")

    def on_toggle_animation(self):
        """处理动画播放切换"""
        if self.animation_controller.is_playing():
            self.animation_controller.stop()
            self.main_view.update_play_button(False)
            self.logger.log("动画已停止", "INFO")
        else:
            sprite_data = self.sprite_manager.get_current_sprite_data()
            if sprite_data and not sprite_data.is_simple_images():
                frame_count = sprite_data.get_frame_count()
                if frame_count > 1:
                    self.animation_controller.start()
                    self.main_view.update_play_button(True)
                    self.logger.log("动画开始播放", "INFO")
                else:
                    self.logger.log("没有可播放的动画帧", "WARN")
            else:
                self.logger.log("简单图片类型不支持动画播放", "WARN")

    def on_animation_speed_changed(self, speed: int):
        """处理动画速度改变"""
        self.animation_controller.set_speed(speed)

    def on_offset_changed(self, offset_x: int, offset_y: int):
        """处理偏移改变"""
        self.current_offset = [offset_x, offset_y]
        self._update_sprite_display()

    def on_toggle_log(self):
        """处理日志显示切换"""
        self.logger.toggle()

    def on_map_zoom(self, factor: float):
        """处理地图缩放"""
        if self.canvas_manager.zoom_map(factor):
            self._update_map_display()

    def on_map_reset(self):
        """处理地图重置"""
        self.canvas_manager.reset_map()
        self._update_map_display()

    def on_export_map(self):
        """处理大地图导出"""
        map_data = self.sprite_manager.get_current_map_data()
        if not map_data:
            messagebox.showwarning("警告", "没有可导出的地图")
            return

        try:
            # 创建导出目录
            import os
            # 获取main.py所在目录
            main_dir = os.path.dirname(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
            export_dir = os.path.join(main_dir, "导出")
            map_export_dir = os.path.join(export_dir, "地图")
            os.makedirs(map_export_dir, exist_ok=True)
            
            # 获取当前地图ID
            current_sprite_id = self.main_view.sprite_id_var.get()
            if not current_sprite_id:
                messagebox.showerror("错误", "无法获取地图ID")
                return
            
            # 生成文件名：地图ID_max.png
            filename = os.path.join(map_export_dir, f"{current_sprite_id}_max.png")
            
            # 导出时不显示遮罩标记，只显示原始地图
            image = map_data.get_rendered_image(False, False, False)
            image.save(filename)
            self.logger.log(f"大地图已导出: {filename}", "INFO")
            messagebox.showinfo("成功", f"大地图已导出到:\n{filename}")
        except Exception as e:
            self.logger.log(f"导出大地图失败: {e}", "ERROR")
            messagebox.showerror("错误", f"导出失败: {e}")

    def on_export_current_view(self):
        """处理当前视图导出"""
        map_data = self.sprite_manager.get_current_map_data()
        if not map_data:
            messagebox.showwarning("警告", "没有可导出的地图")
            return

        try:
            # 创建导出目录
            import os
            # 获取main.py所在目录
            main_dir = os.path.dirname(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
            export_dir = os.path.join(main_dir, "导出")
            map_export_dir = os.path.join(export_dir, "地图")
            os.makedirs(map_export_dir, exist_ok=True)
            
            # 获取当前地图ID
            current_sprite_id = self.main_view.sprite_id_var.get()
            if not current_sprite_id:
                messagebox.showerror("错误", "无法获取地图ID")
                return
            
            # 生成文件名：地图ID_view.png
            filename = os.path.join(map_export_dir, f"{current_sprite_id}_view.png")
            
            # 获取当前画布上显示的地图图像
            canvas_width, canvas_height = self.main_view.get_canvas_size()
            # 导出时不显示遮罩标记，只显示原始地图
            image = map_data.get_rendered_image(False, False, False)
            
            # 创建画布大小的图像
            from PIL import Image
            canvas_image = Image.new('RGBA', (canvas_width, canvas_height), (0, 0, 0, 0))
            
            # 计算缩放后的地图尺寸
            new_width = int(image.width * self.canvas_manager.map_scale)
            new_height = int(image.height * self.canvas_manager.map_scale)
            
            if new_width > 0 and new_height > 0:
                # 缩放地图图像
                resized_image = image.resize((new_width, new_height), Image.LANCZOS)
                
                # 计算绘制位置
                center_x = canvas_width // 2 + self.canvas_manager.map_offset[0]
                center_y = canvas_height // 2 + self.canvas_manager.map_offset[1]
                
                # 计算绘制区域
                draw_x = center_x - new_width // 2
                draw_y = center_y - new_height // 2
                
                # 粘贴到画布图像
                canvas_image.paste(resized_image, (draw_x, draw_y))
                
                # 保存图像
                canvas_image.save(filename)
                self.logger.log(f"当前视图已导出: {filename}", "INFO")
                messagebox.showinfo("成功", f"当前视图已导出到:\n{filename}")
            else:
                messagebox.showerror("错误", "地图尺寸无效")
        except Exception as e:
            self.logger.log(f"导出当前视图失败: {e}", "ERROR")
            messagebox.showerror("错误", f"导出失败: {e}")

    def on_export_mask_images(self):
        """处理遮罩图片导出 - 导出3张图片：原图、遮罩图、合并图"""
        map_data = self.sprite_manager.get_current_map_data()
        if not map_data:
            messagebox.showwarning("警告", "没有可导出的地图")
            return

        try:
            # 创建导出目录
            import os
            # 获取main.py所在目录
            main_dir = os.path.dirname(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
            export_dir = os.path.join(main_dir, "导出")
            map_export_dir = os.path.join(export_dir, "地图")
            os.makedirs(map_export_dir, exist_ok=True)
            
            # 获取当前地图ID
            current_sprite_id = self.main_view.sprite_id_var.get()
            if not current_sprite_id:
                messagebox.showerror("错误", "无法获取地图ID")
                return
            
            # 生成三个文件名
            original_filename = os.path.join(map_export_dir, f"{current_sprite_id}_original.png")
            mask_filename = os.path.join(map_export_dir, f"{current_sprite_id}_mask.png")
            combined_filename = os.path.join(map_export_dir, f"{current_sprite_id}_combined.png")
            
            # 1. 导出原图（不显示任何标记）
            original_image = map_data.get_rendered_image(False, False, False)
            original_image.save(original_filename)
            
            # 2. 导出遮罩图（只显示标记，不显示地图）
            from PIL import Image, ImageDraw
            mask_image = Image.new('RGBA', original_image.size, (0, 0, 0, 0))
            mask_draw = ImageDraw.Draw(mask_image)
            
            # 获取当前显示选项
            show_walkable = self.main_view.show_walkable_var.get()
            show_blocked = self.main_view.show_blocked_var.get()
            show_masked = self.main_view.show_masked_var.get()
            
            # 计算格子尺寸
            cell_width = original_image.width / map_data.width
            cell_height = original_image.height / map_data.height
            
            # 绘制标记
            for y in range(map_data.height):
                for x in range(map_data.width):
                    idx = y * map_data.width + x
                    if idx < len(map_data.cells):
                        cell_value = map_data.cells[idx]
                        
                        # 计算格子的像素坐标
                        x1 = int(x * cell_width)
                        y1 = int(y * cell_height)
                        x2 = int((x + 1) * cell_width)
                        y2 = int((y + 1) * cell_height)
                        
                        # 确保坐标不超出地图边界
                        x2 = min(x2, original_image.width)
                        y2 = min(y2, original_image.height)
                        
                        # 确保坐标有效且在地图范围内
                        if x1 < x2 and y1 < y2 and x1 >= 0 and y1 >= 0:
                            if cell_value == 0 and show_walkable:  # WALKABLE
                                mask_draw.rectangle([x1, y1, x2, y2], fill=(0, 255, 0, 30))
                            elif cell_value == 1 and show_blocked:  # BLOCKED
                                mask_draw.rectangle([x1, y1, x2, y2], fill=(255, 0, 0, 50))
                            elif cell_value == 3 and show_masked:  # MASKED
                                mask_draw.rectangle([x1, y1, x2, y2], fill=(0, 0, 255, 40))
            
            mask_image.save(mask_filename)
            
            # 3. 导出合并图（地图+遮罩）
            combined_image = map_data.get_rendered_image(show_walkable, show_blocked, show_masked)
            combined_image.save(combined_filename)
            
            self.logger.log(f"遮罩图片已导出: {original_filename}, {mask_filename}, {combined_filename}", "INFO")
            messagebox.showinfo("成功", f"遮罩图片已导出到:\n原图: {os.path.basename(original_filename)}\n遮罩图: {os.path.basename(mask_filename)}\n合并图: {os.path.basename(combined_filename)}")
        except Exception as e:
            self.logger.log(f"导出遮罩图片失败: {e}", "ERROR")
            messagebox.showerror("错误", f"导出失败: {e}")

    def on_show_state(self):
        """显示状态窗口"""
        if hasattr(self, 'state_view') and self.state_view:
            self.state_view.toggle()
        else:
            # 创建状态视图
            from ..views.state_view import StateView
            self.state_view = StateView(
                self.main_view.root,
                self.state_manager,
                self.memory_manager,
                self.config_manager,
                self.plugin_manager
            )
            self.state_view.show()
    
    def on_execute_plugin(self, plugin_name: str):
        """执行插件"""
        if self.plugin_manager:
            result = self.plugin_manager.execute_plugin(plugin_name)
            if result:
                self.logger.log(f"插件 {plugin_name} 执行成功", "INFO")
            else:
                self.logger.log(f"插件 {plugin_name} 执行失败", "ERROR")
    
    def on_enable_plugin(self, plugin_name: str):
        """启用插件"""
        if self.plugin_manager:
            if self.plugin_manager.enable_plugin(plugin_name):
                self.logger.log(f"插件 {plugin_name} 已启用", "INFO")
                if self.state_manager:
                    self.state_manager.add_enabled_plugin(plugin_name)
            else:
                self.logger.log(f"启用插件 {plugin_name} 失败", "ERROR")
    
    def on_disable_plugin(self, plugin_name: str):
        """禁用插件"""
        if self.plugin_manager:
            if self.plugin_manager.disable_plugin(plugin_name):
                self.logger.log(f"插件 {plugin_name} 已禁用", "INFO")
                if self.state_manager:
                    self.state_manager.remove_enabled_plugin(plugin_name)
            else:
                self.logger.log(f"禁用插件 {plugin_name} 失败", "ERROR")
    
    def on_optimize_image(self, image_path: str):
        """优化图像"""
        if self.image_optimizer:
            try:
                optimized_image = self.image_optimizer.optimize_for_display(image_path)
                self.logger.log(f"图像优化完成: {image_path}", "INFO")
                return optimized_image
            except Exception as e:
                self.logger.log(f"图像优化失败: {e}", "ERROR")
                return None
    
    def on_enhance_image(self, image_path: str, brightness: float = 1.0, 
                        contrast: float = 1.0, saturation: float = 1.0):
        """增强图像"""
        if self.image_optimizer:
            try:
                enhanced_image = self.image_optimizer.enhance_image(
                    image_path, brightness, contrast, saturation
                )
                self.logger.log(f"图像增强完成: {image_path}", "INFO")
                return enhanced_image
            except Exception as e:
                self.logger.log(f"图像增强失败: {e}", "ERROR")
                return None
    
    def on_export_gif(self, output_path: str, duration: int = 100):
        """导出GIF动画"""
        try:
            sprite_data = self.sprite_manager.get_current_sprite_data()
            if not sprite_data:
                messagebox.showwarning("警告", "没有可导出的素材")
                return
            
            # 获取所有帧
            frames = []
            original_frame = sprite_data.current_frame
            
            # 收集所有帧
            for frame_idx in range(sprite_data.total_frames):
                sprite_data.current_frame = frame_idx
                frame_image = sprite_data.get_current_frame_image()
                if frame_image:
                    frames.append(frame_image)
            
            # 恢复原始帧
            sprite_data.current_frame = original_frame
            
            if frames:
                # 保存GIF
                frames[0].save(
                    output_path,
                    save_all=True,
                    append_images=frames[1:],
                    duration=duration,
                    loop=0
                )
                self.logger.log(f"GIF导出成功: {output_path}", "INFO")
                messagebox.showinfo("成功", f"GIF已导出到: {output_path}")
            else:
                messagebox.showerror("错误", "没有可导出的帧")
                
        except Exception as e:
            self.logger.log(f"GIF导出失败: {e}", "ERROR")
            messagebox.showerror("错误", f"导出失败: {e}")
    
    def on_export_minimap(self, output_path: str, size: tuple = (256, 256)):
        """导出小地图"""
        try:
            map_data = self.sprite_manager.get_current_map_data()
            if not map_data:
                messagebox.showwarning("警告", "没有可导出的地图")
                return
            
            # 获取地图图像
            map_image = map_data.get_rendered_image(False, False, False)
            
            # 创建小地图
            from PIL import Image as _PILImage
            minimap = map_image.resize(size, _PILImage.LANCZOS)
            
            # 保存小地图
            minimap.save(output_path)
            self.logger.log(f"小地图导出成功: {output_path}", "INFO")
            messagebox.showinfo("成功", f"小地图已导出到: {output_path}")
            
        except Exception as e:
            self.logger.log(f"小地图导出失败: {e}", "ERROR")
            messagebox.showerror("错误", f"导出失败: {e}")
    
    def on_save_config(self):
        """保存配置"""
        if self.config_manager:
            self.config_manager.save_config()
            self.logger.log("配置已保存", "INFO")
    
    def on_load_config(self):
        """加载配置"""
        if self.config_manager:
            self.config_manager.load_config()
            self.logger.log("配置已加载", "INFO")
    
    def on_reset_config(self):
        """重置配置"""
        if self.config_manager:
            self.config_manager.reset_config()
            self.logger.log("配置已重置", "INFO")
    
    def on_show_performance(self):
        """显示性能信息"""
        if self.memory_manager:
            stats = self.memory_manager.get_performance_summary()
            if stats:
                info = f"内存使用: {stats.get('memory_mb', 0):.1f}MB\n"
                info += f"CPU使用率: {stats.get('cpu_percent', 0):.1f}%\n"
                info += f"缓存大小: {stats.get('cache_size_mb', 0):.1f}MB\n"
                info += f"缓存项数: {stats.get('cache_items', 0)}\n"
                info += f"运行时间: {stats.get('uptime_seconds', 0):.0f}秒"
                
                messagebox.showinfo("性能信息", info)
    
    def on_clear_cache(self):
        """清理缓存"""
        if self.memory_manager:
            self.memory_manager.clear_cache()
            self.logger.log("缓存已清理", "INFO")
            messagebox.showinfo("成功", "缓存已清理")
    
    def on_trigger_event(self, event_type: str, data: dict = None):
        """触发事件"""
        from ..utils.event_system import publish
        publish(event_type, data)
        self.logger.log(f"事件已触发: {event_type}", "INFO")
    
    def on_show_settings(self):
        """显示设置窗口"""
        if hasattr(self, 'settings_view') and self.settings_view:
            self.settings_view.toggle()
        else:
            # 创建设置视图
            from ..views.settings_view import SettingsView
            self.settings_view = SettingsView(
                self.main_view.root,
                self.config_manager,
                self.state_manager
            )
            self.settings_view.show()
    
    def on_open_map_editor(self):
        """打开地图编辑器"""
        map_data = self.sprite_manager.get_current_map_data()
        if not map_data:
            messagebox.showwarning("警告", "没有可编辑的地图")
            return
        
        if hasattr(self, 'map_editor_view') and self.map_editor_view:
            self.map_editor_view.show()
        else:
            # 创建地图编辑器
            from ..views.map_editor_view import MapEditorView
            self.map_editor_view = MapEditorView(
                self.main_view.root,
                map_data,
                self.config_manager
            )
            self.map_editor_view.show()

    def on_map_fit(self):
        """处理地图自适应"""
        map_data = self.sprite_manager.get_current_map_data()
        map_size = None
        if map_data:
            # 获取地图尺寸
            try:
                image = map_data.get_rendered_image(True, True, True)
                map_size = (image.width, image.height)
            except:
                pass
        
        if self.canvas_manager.fit_map_to_canvas(self.main_view.get_canvas_size(), map_size):
            self._update_map_display()
            self.logger.log("地图已自适应到画布", "INFO")

    def on_map_max(self):
        """处理地图最大显示"""
        if self.canvas_manager.maximize_map():
            self._update_map_display()
            self.logger.log("地图已最大化显示", "INFO")

    def on_map_display_changed(self, show_walkable: bool, show_blocked: bool, show_masked: bool):
        """处理地图显示选项改变"""
        map_data = self.sprite_manager.get_current_map_data()
        if map_data:
            # 使用智能缓存管理，只清除标记相关的缓存
            map_data.clear_mark_cache()
            
            # 不清除画布缓存，让新的渲染结果自动更新缓存
            # 这样可以保持地图显示，同时确保新内容正确显示
            
            # 立即更新显示，保持流畅性
            self._update_map_display()

    def on_reset_offset(self):
        """处理重置偏移"""
        self.main_view.reset_offset_controls()
        self.current_offset = [0, 0]
        self._update_sprite_display()
        self.logger.log("偏移已重置", "INFO")

    def on_export_current_frame(self):
        """处理导出当前帧"""
        sprite_data = self.sprite_manager.get_current_sprite_data()
        if not sprite_data:
            messagebox.showwarning("警告", "没有可导出的帧")
            return

        current_frame = sprite_data.get_current_frame()
        if not current_frame:
            messagebox.showwarning("警告", "没有可导出的帧")
            return

        filename = filedialog.asksaveasfilename(
            defaultextension=".png",
            filetypes=[("PNG图片", "*.png"), ("JPEG图片", "*.jpg"), ("所有文件", "*.*")],
            title="导出当前帧"
        )

        if filename:
            try:
                current_frame.image.save(filename)
                self.logger.log(f"当前帧已导出: {filename}", "INFO")
                messagebox.showinfo("成功", f"当前帧已导出到:\n{filename}")
            except Exception as e:
                self.logger.log(f"导出当前帧失败: {e}", "ERROR")
                messagebox.showerror("错误", f"导出失败: {e}")

    def on_canvas_configure(self):
        """处理画布配置改变"""
        # 只在地图类型时才重新绘制，避免简单图片被清除
        map_data = self.sprite_manager.get_current_map_data()
        if map_data:
            self._update_display()

    def on_canvas_press(self, x: int, y: int):
        """处理画布按下"""
        map_data = self.sprite_manager.get_current_map_data()
        if map_data:
            self.canvas_manager.start_drag(x, y)

    def on_canvas_drag(self, x: int, y: int):
        """处理画布拖拽"""
        map_data = self.sprite_manager.get_current_map_data()
        if map_data and self.canvas_manager.drag_map(x, y):
            # 拖拽时立即更新显示，保持流畅性
            self._update_map_display()

    def on_canvas_wheel(self, x: int, y: int, delta: int):
        """处理画布滚轮"""
        map_data = self.sprite_manager.get_current_map_data()
        if map_data:
            factor = 1.1 if delta > 0 else 0.9
            canvas_width, canvas_height = self.main_view.get_canvas_size()
            if self.canvas_manager.zoom_map_at_point(factor, x, y, canvas_width, canvas_height):
                # 缩放时立即更新显示，保持流畅性
                self._update_map_display()

    # 私有方法
    def _clear_display(self):
        """清除显示"""
        self.main_view.clear_canvas()
        self.canvas_manager.reset()

    def _clear_cache(self):
        """清除缓存"""
        # 清除精灵管理器缓存
        self.sprite_manager.clear_cache()
        
        # 清除画布管理器缓存
        self.canvas_manager._cached_images.clear()
        
        # 重置偏移
        self.current_offset = [0, 0]
        self.main_view.reset_offset_controls()
        
        self.logger.log("缓存已清除", "INFO")

    def _draw_retained_sprites(self, canvas_width: int, canvas_height: int):
        """绘制保留的素材"""
        visible_sprites = self.retained_sprite_manager.get_visible_retained_sprites()
        
        for sprite in visible_sprites:
            current_frame = sprite.sprite_data.get_current_frame()
            if current_frame:
                # 计算显示位置（在画布中心显示）
                offset_x = current_frame.offset_x
                offset_y = current_frame.offset_y
                
                center_x = canvas_width // 2 + offset_x
                center_y = canvas_height // 2 + offset_y
                
                # 获取Tkinter图像
                tk_image = current_frame.get_tk_image()
                
                # 在画布上绘制
                if self.main_view.canvas:
                    self.main_view.canvas.create_image(center_x, center_y, image=tk_image, anchor=tk.CENTER)
                    self.logger.log(f"绘制保留素材: {sprite.name} 在位置 ({center_x}, {center_y})", "DEBUG")

    def on_retain_current_sprite(self):
        """保留当前素材"""
        if self.current_sprite_type == "map":
            messagebox.showwarning("警告", "地图类型不支持保留功能")
            return
            
        sprite_data = self.sprite_manager.get_current_sprite_data()
        if not sprite_data:
            messagebox.showwarning("警告", "没有可保留的素材")
            return
            
        # 生成素材名称
        action_name = sprite_data.action if sprite_data.action else "无动作"
        sprite_name = f"{sprite_data.sprite_type}_{sprite_data.sprite_id}_{action_name}"
        
        # 添加到保留管理器
        key = self.retained_sprite_manager.add_retained_sprite(
            sprite_data.sprite_type, 
            sprite_data.sprite_id, 
            sprite_data.action, 
            sprite_data, 
            sprite_name
        )
        
        # 更新UI
        self._update_retained_sprites_list()
        messagebox.showinfo("成功", f"素材已保留: {sprite_name}")

    def on_clear_all_retained(self):
        """清除所有保留素材"""
        result = messagebox.askyesno("确认", "确定要清除所有保留的素材吗？")
        if result:
            self.retained_sprite_manager.clear_all_retained_sprites()
            self._update_retained_sprites_list()
            self._update_display()

    def on_import_selected_sprite(self):
        """引入选中的保留素材"""
        selected_index = self.main_view.get_selected_retained_sprite_index()
        if selected_index == -1:
            messagebox.showwarning("警告", "请先选择一个保留的素材")
            return
            
        retained_sprites = self.retained_sprite_manager.get_all_retained_sprites()
        if selected_index < len(retained_sprites):
            sprite = retained_sprites[selected_index]
            sprite.visible = True
            self._update_retained_sprites_list()
            self._update_display()
            self.logger.log(f"引入保留素材: {sprite.name}", "INFO")
            messagebox.showinfo("成功", f"已引入保留素材: {sprite.name}")

    def on_remove_selected_sprite(self):
        """移除选中的保留素材"""
        selected_index = self.main_view.get_selected_retained_sprite_index()
        if selected_index == -1:
            messagebox.showwarning("警告", "请先选择一个保留的素材")
            return
            
        retained_sprites = self.retained_sprite_manager.get_all_retained_sprites()
        if selected_index < len(retained_sprites):
            sprite = retained_sprites[selected_index]
            key = f"{sprite.sprite_type}_{sprite.sprite_id}_{sprite.action.value if sprite.action else 'none'}"
            self.retained_sprite_manager.remove_retained_sprite(key)
            self._update_retained_sprites_list()
            self._update_display()

    def on_toggle_selected_visibility(self):
        """切换选中素材的可见性"""
        selected_index = self.main_view.get_selected_retained_sprite_index()
        if selected_index == -1:
            messagebox.showwarning("警告", "请先选择一个保留的素材")
            return
            
        retained_sprites = self.retained_sprite_manager.get_all_retained_sprites()
        if selected_index < len(retained_sprites):
            sprite = retained_sprites[selected_index]
            key = f"{sprite.sprite_type}_{sprite.sprite_id}_{sprite.action.value if sprite.action else 'none'}"
            self.retained_sprite_manager.toggle_sprite_visibility(key)
            self._update_retained_sprites_list()
            self._update_display()

    def _redraw_simple_image(self):
        """重新绘制简单图片，确保在UI更新后仍然显示"""
        sprite_data = self.sprite_manager.get_current_sprite_data()
        if not sprite_data or not sprite_data.is_simple_images():
            return
            
        simple_images = sprite_data.get_simple_images()
        if not simple_images:
            return
            
        try:
            from PIL import Image, ImageTk
            img = Image.open(simple_images[0])
            tk_image = ImageTk.PhotoImage(img)
            
            # 获取画布尺寸
            canvas_width, canvas_height = self.main_view.get_canvas_size()
            
            # 计算显示位置（居中）
            center_x = canvas_width // 2
            center_y = canvas_height // 2
            
            # 获取参考线和背景信息
            reference_lines = self.canvas_manager.get_reference_lines(canvas_width, canvas_height)
            background_info = self.canvas_manager.get_background_info()
            
            # 重新绘制主图像
            self.main_view.draw_image_on_canvas(tk_image, center_x, center_y, reference_lines, background_info)
            
            # 重新绘制保留的素材
            self._draw_retained_sprites(canvas_width, canvas_height)
            
            self.logger.log(f"简单图片重新绘制成功: {simple_images[0]}", "DEBUG")
        except Exception as e:
            self.logger.log(f"重新绘制简单图片失败: {e}", "ERROR")

    def _update_retained_sprites_list(self):
        """更新保留素材列表"""
        retained_sprites = self.retained_sprite_manager.get_all_retained_sprites()
        self.main_view.update_retained_sprites_list(retained_sprites)

    def on_split_current_sprite(self):
        """拆图当前ID"""
        if self.current_sprite_type == "map":
            messagebox.showwarning("警告", "地图类型不支持拆图功能")
            return
            
        sprite_id = self.main_view.sprite_id_var.get()
        if not sprite_id:
            messagebox.showwarning("警告", "请先选择一个素材ID")
            return
            
        # 自动创建输出目录
        import os
        # 获取main.py所在目录
        main_dir = os.path.dirname(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
        export_dir = os.path.join(main_dir, "导出")
        sprite_type_name = self.current_sprite_type
        output_dir = os.path.join(export_dir, sprite_type_name)
        os.makedirs(output_dir, exist_ok=True)
        
        # 导入拆图工具
        from ..utils.sprite_splitter import SpriteSplitter
        splitter = SpriteSplitter(self.logger)
        
        def split_callback(result, error):
            if error:
                messagebox.showerror("错误", f"拆图失败: {sprite_id}\n{error}")
            elif result:
                messagebox.showinfo("成功", f"拆图完成: {sprite_id}\n输出目录: {output_dir}")
            else:
                messagebox.showerror("错误", f"拆图失败: {sprite_id}")
        
        # 异步执行拆图
        self.async_loader.split_sprite_async(splitter, self.sprite_manager, self.current_sprite_type, sprite_id, output_dir, split_callback)

    def on_split_all_sprites(self):
        """拆图所有ID"""
        if self.current_sprite_type == "map":
            messagebox.showwarning("警告", "地图类型不支持拆图功能")
            return
            
        # 自动创建输出目录
        import os
        # 获取main.py所在目录
        main_dir = os.path.dirname(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
        export_dir = os.path.join(main_dir, "导出")
        sprite_type_name = self.current_sprite_type
        output_dir = os.path.join(export_dir, sprite_type_name)
        os.makedirs(output_dir, exist_ok=True)
        
        # 确认操作
        result = messagebox.askyesno("确认", f"确定要拆分 {self.current_sprite_type} 类型的所有素材吗？\n这可能需要一些时间。\n输出目录: {output_dir}")
        if not result:
            return
            
        # 导入拆图工具
        from ..utils.sprite_splitter import SpriteSplitter
        splitter = SpriteSplitter(self.logger)
        
        # 执行拆图
        results = splitter.split_all_sprites(self.sprite_manager, self.current_sprite_type, output_dir)
        
        # 统计结果
        success_count = sum(1 for success in results.values() if success)
        total_count = len(results)
        
        messagebox.showinfo("完成", f"拆图完成: {self.current_sprite_type}\n成功: {success_count}/{total_count}\n输出目录: {output_dir}")

    def on_toggle_reference_lines(self):
        """切换参考线显示"""
        self.canvas_manager.toggle_reference_lines()
        self._update_display()

    def on_set_background_color(self):
        """设置背景颜色"""
        from tkinter import colorchooser
        color = colorchooser.askcolor(title="选择背景颜色")[1]
        if color:
            self.canvas_manager.set_background_color(color)
            self._update_display()

    def on_set_transparent_background(self):
        """设置透明背景"""
        self.canvas_manager.set_background_transparent()
        self._update_display()

    def _update_actions_display(self):
        """更新动作显示和方向显示"""
        sprite_data = self.sprite_manager.get_current_sprite_data()
        
        # 检查是否是支持动作选择的子类型（human, weapon, monster）
        if (self.current_sprite_type == "scene" and 
            self.current_subtype in ["human", "weapon", "monster"] and 
            sprite_data and not sprite_data.is_simple_images()):
            
            # 对于支持动作选择的子类型，显示动作选择
            available_actions = []
            for frame in sprite_data.frames.values():
                if hasattr(frame, 'action') and frame.action not in available_actions:
                    available_actions.append(frame.action)
            
            # 如果没有找到动作信息，根据子类型使用默认动作列表
            if not available_actions:
                if self.current_subtype == "human":
                    available_actions = ["stand", "run", "prepare_attack", "attack", "cast", "death", "ride_stand", "ride_run"]
                elif self.current_subtype == "weapon":
                    available_actions = ["stand", "run", "prepare_attack", "attack", "cast", "death"]
                elif self.current_subtype == "monster":
                    available_actions = ["stand", "run", "attack", "death"]
                else:
                    available_actions = ["stand"]
            
            self.main_view.update_actions(available_actions)
            
            # 显示动作选择框架
            if hasattr(self.main_view, 'action_frame'):
                if not self.main_view.action_frame.winfo_ismapped():
                    self.main_view.action_frame.pack(pady=10, fill=tk.X, padx=10)
        else:
            # 其他类型不需要动作选择，隐藏动作选择器
            self.main_view.update_actions([])
        
        # 更新方向显示 - 但地图类型不需要方向和动画控制
        if (sprite_data and not sprite_data.is_simple_images() and 
            self.current_sprite_type not in ["map", "h5_map"]):
            # 如果有动画帧，提取可用的方向
            available_directions = []
            for frame in sprite_data.frames.values():
                if hasattr(frame, 'direction') and frame.direction not in available_directions:
                    available_directions.append(frame.direction)
            
            # 如果没有找到方向信息，使用默认方向
            if not available_directions:
                available_directions = ["down", "up", "left", "right", "up_left", "up_right", "down_left", "down_right"]
            
            self.main_view.update_directions(available_directions)
            
            # 显示方向控制（对于有动画帧的素材）
            if hasattr(self.main_view, 'direction_frame'):
                if not self.main_view.direction_frame.winfo_ismapped():
                    self.main_view.direction_frame.pack(pady=10, fill=tk.X, padx=10)
            
            # 显示动画控制（对于有动画帧的素材）
            if hasattr(self.main_view, 'animation_offset_notebook'):
                if not self.main_view.animation_offset_notebook.winfo_ismapped():
                    self.main_view.animation_offset_notebook.pack(pady=5, fill=tk.X, padx=10)
        else:
            # 如果是简单图片或地图类型，隐藏方向控制和动画控制
            if hasattr(self.main_view, 'direction_frame'):
                self.main_view.direction_frame.pack_forget()
            if hasattr(self.main_view, 'animation_offset_notebook'):
                self.main_view.animation_offset_notebook.pack_forget()
            
            # 对于简单图片类型（非地图类型），确保action_frame显示（包含播放按钮等）
            if (hasattr(self.main_view, 'action_frame') and 
                self.current_sprite_type not in ["map", "h5_map"]):
                if not self.main_view.action_frame.winfo_ismapped():
                    self.main_view.action_frame.pack(pady=10, fill=tk.X, padx=10)

    def _update_tools_display(self):
        """更新工具显示"""
        self.main_view.update_tools_display(self.current_sprite_type)

    def _refresh_sprite_ids(self):
        """刷新精灵ID列表"""
        try:
            if self.current_sprite_type == "map":
                map_ids = self.sprite_manager.get_sprite_ids("map")
                self.main_view.update_sprite_ids(map_ids)
            elif self.current_sprite_type == "h5_map":
                map_ids = self.sprite_manager.get_sprite_ids("h5_map")
                self.main_view.update_sprite_ids(map_ids)
            elif self.current_sprite_type == "scene" and self.current_subtype:
                sprite_ids = self.sprite_manager.get_sprite_ids("scene", self.current_subtype)
                self.main_view.update_sprite_ids(sprite_ids)
            else:
                self.main_view.update_sprite_ids([])
        except Exception as e:
            self.logger.log(f"刷新素材ID列表失败: {e}", "ERROR")

    def _update_display(self):
        """更新显示"""
        map_data = self.sprite_manager.get_current_map_data()
        sprite_data = self.sprite_manager.get_current_sprite_data()

        if map_data:
            # 检查地图是否包含简单图片
            if hasattr(map_data, 'tiles') and map_data.tiles:
                # 地图包含切片文件，按地图方式显示
                self._update_map_display()
            else:
                # 地图没有切片文件，可能是简单图片类型
                self._update_simple_map_display()
        elif sprite_data:
            # 如果是简单图片类型，确保停止动画
            if sprite_data.is_simple_images():
                self.animation_controller.stop()
                self.main_view.update_play_button(False)
            self._update_sprite_display()
        else:
            self.main_view.clear_canvas()

    def _update_map_display(self):
        """更新地图显示"""
        try:
            map_data = self.sprite_manager.get_current_map_data()
            if not map_data:
                return

            # 获取渲染选项
            show_walkable = self.main_view.show_walkable_var.get()
            show_blocked = self.main_view.show_blocked_var.get()
            show_masked = self.main_view.show_masked_var.get()

            # 获取渲染后的图像（包含标记）
            image = map_data.get_rendered_image(show_walkable, show_blocked, show_masked)
            if not image:
                # 如果渲染失败，尝试获取基础图像
                image = map_data.get_base_image()
                if not image:
                    # 如果还是失败，创建一个默认的空白地图
                    from PIL import Image
                    image = Image.new('RGBA', (800, 600), (128, 128, 128, 255))
                    self.logger.log("使用默认空白地图", "WARNING")

            # 获取画布尺寸
            canvas_width, canvas_height = self.main_view.get_canvas_size()
            if canvas_width <= 1 or canvas_height <= 1:
                return

            # 渲染到画布
            rendered_image = self.canvas_manager.render_map_to_canvas(
                image, canvas_width, canvas_height
            )

            if rendered_image:
                center_x = canvas_width // 2 + self.canvas_manager.map_offset[0]
                center_y = canvas_height // 2 + self.canvas_manager.map_offset[1]
                self.main_view.draw_image_on_canvas(rendered_image, center_x, center_y)

                # 更新信息（包含地图尺寸和缩放信息）
                map_size = image.size
                scale_info = f"缩放: {self.canvas_manager.map_scale:.2f}x"
                canvas_info = f"画布: {canvas_width}x{canvas_height}"
                map_info = f"地图: {map_size[0]}x{map_size[1]}"
                info = f"地图: {map_data.name} | {map_info} | {canvas_info} | {scale_info} | (绿色:可通行, 红色:不可通行, 蓝色:遮罩区域)"
                self.main_view.update_info(info)
                
                # 记录成功显示
                self.logger.log(f"地图显示成功: {map_data.name}, 尺寸: {map_size[0]}x{map_size[1]}", "INFO")
            else:
                self.logger.log("地图渲染失败", "ERROR")

        except Exception as e:
            self.logger.log(f"更新地图显示失败: {e}", "ERROR")

    def _update_simple_map_display(self):
        """更新简单地图显示（没有切片的地图，可能是简单图片）"""
        try:
            map_data = self.sprite_manager.get_current_map_data()
            if not map_data:
                return

            # 获取画布尺寸
            canvas_width, canvas_height = self.main_view.get_canvas_size()
            if canvas_width <= 1 or canvas_height <= 1:
                return

            # 尝试获取地图图片
            image = map_data.get_map_image()
            if not image:
                self.logger.log("无法获取地图图片", "ERROR")
                return

            # 将PIL图像转换为Tkinter图像
            from PIL import ImageTk
            tk_image = ImageTk.PhotoImage(image)

            # 计算显示位置（居中）
            center_x = canvas_width // 2
            center_y = canvas_height // 2

            # 获取参考线和背景信息
            reference_lines = self.canvas_manager.get_reference_lines(canvas_width, canvas_height)
            background_info = self.canvas_manager.get_background_info()

            # 绘制主图像
            self.main_view.draw_image_on_canvas(tk_image, center_x, center_y, reference_lines, background_info)

            # 绘制保留的素材
            self._draw_retained_sprites(canvas_width, canvas_height)

            # 更新信息
            image_size = image.size
            info = f"简单地图: {map_data.name} | 图片大小: {image_size[0]}x{image_size[1]} 像素"
            self.main_view.update_info(info)

            # 确保动画停止并更新UI状态
            self.animation_controller.stop()
            self.main_view.update_play_button(False)

            # 强制更新UI，确保图片显示
            self.main_view.root.update()

            self.logger.log(f"简单地图显示成功: {map_data.name}", "INFO")

        except Exception as e:
            self.logger.log(f"更新简单地图显示失败: {e}", "ERROR")

    def _update_sprite_display(self):
        """更新精灵显示"""
        sprite_data = self.sprite_manager.get_current_sprite_data()
        if not sprite_data:
            return

        # 获取画布尺寸
        canvas_width, canvas_height = self.main_view.get_canvas_size()
        self.logger.log(f"画布尺寸: {canvas_width}x{canvas_height}", "DEBUG")

        if sprite_data.is_simple_images():
            # 处理简单图片类型
            simple_images = sprite_data.get_simple_images()
            self.logger.log(f"简单图片数量: {len(simple_images)}", "DEBUG")
            if simple_images:
                # 显示第一张图片
                try:
                    from PIL import Image, ImageTk
                    img = Image.open(simple_images[0])
                    tk_image = ImageTk.PhotoImage(img)
                    
                    # 计算显示位置（居中）
                    center_x = canvas_width // 2
                    center_y = canvas_height // 2
                    
                    self.logger.log(f"显示位置: ({center_x}, {center_y})", "DEBUG")
                    self.logger.log(f"图片路径: {simple_images[0]}", "DEBUG")
                    self.logger.log(f"图片尺寸: {img.size}", "DEBUG")
                    
                    # 获取参考线和背景信息
                    reference_lines = self.canvas_manager.get_reference_lines(canvas_width, canvas_height)
                    background_info = self.canvas_manager.get_background_info()
                    
                    # 绘制主图像
                    self.main_view.draw_image_on_canvas(tk_image, center_x, center_y, reference_lines, background_info)
                    
                    # 绘制保留的素材
                    self._draw_retained_sprites(canvas_width, canvas_height)

                    # 更新信息
                    image_size = img.size
                    info = f"简单图片: {sprite_data.sprite_type} - {sprite_data.sprite_id} | 图片大小: {image_size[0]}x{image_size[1]} 像素 | 总数: {len(simple_images)}"
                    self.main_view.update_info(info)
                    
                    # 确保动画停止并更新UI状态
                    self.animation_controller.stop()
                    self.main_view.update_play_button(False)
                    
                    # 强制更新UI，确保图片显示
                    self.main_view.root.update()
                    
                    # 保存当前显示的图片引用，防止被垃圾回收
                    self._current_simple_image = tk_image
                    
                    self.logger.log(f"简单图片显示成功: {simple_images[0]}", "INFO")
                except Exception as e:
                    self.logger.log(f"显示简单图片失败: {e}", "ERROR")
                    import traceback
                    self.logger.log(f"错误详情: {traceback.format_exc()}", "ERROR")
        else:
            # 处理动画精灵类型
            current_frame = sprite_data.get_current_frame()
            if not current_frame:
                return

            # 计算显示位置
            offset_x = current_frame.offset_x + self.current_offset[0]
            offset_y = current_frame.offset_y + self.current_offset[1]

            center_x = canvas_width // 2 + offset_x
            center_y = canvas_height // 2 + offset_y

            # 显示图像
            tk_image = current_frame.get_tk_image()
            
            # 获取参考线和背景信息
            reference_lines = self.canvas_manager.get_reference_lines(canvas_width, canvas_height)
            background_info = self.canvas_manager.get_background_info()
            
            # 绘制主图像
            self.main_view.draw_image_on_canvas(tk_image, center_x, center_y, reference_lines, background_info)
            
            # 绘制保留的素材
            self._draw_retained_sprites(canvas_width, canvas_height)

            # 更新信息（包含图片大小）
            image_size = current_frame.image.size
            info = f"精灵: {sprite_data.sprite_type} - {sprite_data.sprite_id} | 图片大小: {image_size[0]}x{image_size[1]} 像素"
            self.main_view.update_info(info)
            
            # 强制更新UI状态
            self._force_update_ui()
    
    def _update_sprite_display_only(self):
        """只更新精灵显示，不更新UI控件"""
        sprite_data = self.sprite_manager.get_current_sprite_data()
        if not sprite_data:
            return

        # 获取画布尺寸
        canvas_width = self.main_view.canvas.winfo_width()
        canvas_height = self.main_view.canvas.winfo_height()
        
        if canvas_width <= 1 or canvas_height <= 1:
            return

        if sprite_data.is_simple_images():
            # 处理简单图片类型
            simple_images = sprite_data.get_simple_images()
            if simple_images:
                try:
                    from PIL import Image, ImageTk
                    img = Image.open(simple_images[0])
                    tk_image = ImageTk.PhotoImage(img)
                    
                    # 计算显示位置（居中）
                    center_x = canvas_width // 2
                    center_y = canvas_height // 2
                    
                    # 获取参考线和背景信息
                    reference_lines = self.canvas_manager.get_reference_lines(canvas_width, canvas_height)
                    background_info = self.canvas_manager.get_background_info()
                    
                    # 绘制主图像
                    self.main_view.draw_image_on_canvas(tk_image, center_x, center_y, reference_lines, background_info)
                    
                    # 绘制保留的素材
                    self._draw_retained_sprites(canvas_width, canvas_height)
                    
                    # 保存当前显示的图片引用，防止被垃圾回收
                    self._current_simple_image = tk_image
                except Exception as e:
                    self.logger.log(f"显示简单图片失败: {e}", "ERROR")
        else:
            # 处理动画精灵类型
            current_frame = sprite_data.get_current_frame()
            if not current_frame:
                return

            # 计算显示位置
            offset_x = current_frame.offset_x + self.current_offset[0]
            offset_y = current_frame.offset_y + self.current_offset[1]

            center_x = canvas_width // 2 + offset_x
            center_y = canvas_height // 2 + offset_y

            # 显示图像
            tk_image = current_frame.get_tk_image()
            
            # 获取参考线和背景信息
            reference_lines = self.canvas_manager.get_reference_lines(canvas_width, canvas_height)
            background_info = self.canvas_manager.get_background_info()
            
            # 绘制主图像
            self.main_view.draw_image_on_canvas(tk_image, center_x, center_y, reference_lines, background_info)
            
            # 绘制保留的素材
            self._draw_retained_sprites(canvas_width, canvas_height)
    
    def show_plugin_manager(self):
        """显示插件管理器"""
        try:
            from ..views.plugin_manager_view import PluginManagerView
            
            # 创建插件管理器视图
            plugin_manager_view = PluginManagerView(
                self.main_view.root, 
                self.plugin_manager, 
                self.config_manager
            )
            
            # 显示插件管理器
            plugin_manager_view.show_plugin_manager()
            
            self.logger.log("插件管理器已打开", "INFO")
            
        except Exception as e:
            self.logger.log(f"打开插件管理器失败: {e}", "ERROR")
            messagebox.showerror("错误", f"无法打开插件管理器: {e}")
    
    def show_settings(self):
        """显示设置窗口"""
        # 调用原来的设置方法
        self.on_show_settings()
    
    def on_subtype_changed(self, subtype: str):
        """处理子类型改变"""
        self.current_subtype = subtype
        self.logger.log(f"子类型切换为: {subtype}", "INFO")
        
        # 停止动画播放（因为切换子类型时应该停止当前动画）
        self.animation_controller.stop()
        self.main_view.update_play_button(False)
        
        # 清除显示和缓存
        self._clear_display()
        self._clear_cache()
        
        # 刷新素材ID列表
        self._refresh_sprite_ids()
        
        # 强制更新UI状态
        self._force_update_ui()
        
        # 如果子类型有效，自动选择第一个素材ID
        if subtype:
            sprite_ids = self.sprite_manager.get_sprite_ids("scene", subtype)
            if sprite_ids:
                self.logger.log(f"子类型 {subtype} 下有 {len(sprite_ids)} 个素材", "INFO")
    
    def _update_scene_subtypes(self):
        """更新场景子类型列表"""
        try:
            subtypes = self.sprite_manager.get_scene_subtypes()
            self.logger.log(f"找到 {len(subtypes)} 个场景子类型: {subtypes[:5]}...", "INFO")
            self.main_view.update_subtypes(subtypes)
            
            # 如果有子类型，自动选择第一个并触发加载
            if subtypes:
                self.current_subtype = subtypes[0]
                # 设置UI中的选中值
                self.main_view.subtype_var.set(self.current_subtype)
                self.logger.log(f"自动选择第一个子类型: {self.current_subtype}", "INFO")
                
                # 触发子类型改变事件，加载对应的素材ID
                self.on_subtype_changed(self.current_subtype)
        except Exception as e:
            self.logger.log(f"更新场景子类型失败: {e}", "ERROR")
    
    def _update_map_list(self):
        """更新地图列表"""
        try:
            if self.current_sprite_type == "map":
                map_ids = self.sprite_manager.get_sprite_ids("map")
                self.logger.log(f"找到 {len(map_ids)} 个普通地图", "INFO")
            elif self.current_sprite_type == "h5_map":
                map_ids = self.sprite_manager.get_sprite_ids("h5_map")
                self.logger.log(f"找到 {len(map_ids)} 个H5地图", "INFO")
            else:
                map_ids = []
            
            self.main_view.update_sprite_ids(map_ids)
        except Exception as e:
            self.logger.log(f"更新地图列表失败: {e}", "ERROR")
    
    def _refresh_sprite_ids(self):
        """刷新素材ID列表"""
        try:
            if self.current_sprite_type == "map":
                map_ids = self.sprite_manager.get_sprite_ids("map")
                self.main_view.update_sprite_ids(map_ids)
            elif self.current_sprite_type == "h5_map":
                map_ids = self.sprite_manager.get_sprite_ids("h5_map")
                self.main_view.update_sprite_ids(map_ids)
            elif self.current_sprite_type == "scene" and self.current_subtype:
                sprite_ids = self.sprite_manager.get_sprite_ids("scene", self.current_subtype)
                self.main_view.update_sprite_ids(sprite_ids)
            else:
                self.main_view.update_sprite_ids([])
        except Exception as e:
            self.logger.log(f"刷新素材ID列表失败: {e}", "ERROR")