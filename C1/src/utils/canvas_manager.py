# src/utils/canvas_manager.py - 修复导入
from typing import Optional, Tuple, List
from PIL import Image, ImageTk

# 其余代码保持不变...


class CanvasManager:
    """画布管理器 - 处理地图缩放、拖拽等操作"""

    def __init__(self, logger):
        self.logger = logger

        # 地图状态
        self.map_scale = 1.0
        self.map_offset = [0, 0]
        self.map_min_scale = 0.1
        self.map_max_scale = 5.0

        # 拖拽状态
        self.drag_start: Optional[Tuple[int, int]] = None

        # 缓存
        self._cached_images = {}
        
        # 参考线设置
        self.show_reference_lines = False
        
        # 背景设置
        self.background_type = "transparent"  # transparent, color, image
        self.background_color = "#000000"  # 默认黑色
        self.background_image = None

    def reset(self):
        """重置所有状态"""
        self.map_scale = 1.0
        self.map_offset = [0, 0]
        self.drag_start = None
        self._cached_images.clear()

    def reset_map(self):
        """重置地图视图"""
        self.map_scale = 1.0
        self.map_offset = [0, 0]
        self._cached_images.clear()
        self.logger.log("地图视图已重置", "INFO")

    def zoom_map(self, factor: float) -> bool:
        """缩放地图"""
        old_scale = self.map_scale
        new_scale = self.map_scale * factor
        new_scale = max(self.map_min_scale, min(self.map_max_scale, new_scale))

        if new_scale != old_scale:
            self.map_scale = new_scale
            self._cached_images.clear()
            self.logger.log(f"地图缩放: {old_scale:.2f} -> {new_scale:.2f}", "INFO")
            return True
        else:
            self.logger.log(f"已达到缩放限制: {self.map_min_scale} - {self.map_max_scale}", "WARN")
            return False

    def zoom_map_at_point(self, factor: float, mouse_x: int, mouse_y: int,
                          canvas_width: int, canvas_height: int) -> bool:
        """在指定点缩放地图"""
        old_scale = self.map_scale
        if not self.zoom_map(factor):
            return False

        # 计算鼠标相对于当前图像中心的偏移
        center_x = canvas_width // 2
        center_y = canvas_height // 2

        offset_x = mouse_x - center_x - self.map_offset[0]
        offset_y = mouse_y - center_y - self.map_offset[1]

        # 调整偏移以保持鼠标位置不变
        scale_change = self.map_scale / old_scale
        self.map_offset[0] -= offset_x * (scale_change - 1)
        self.map_offset[1] -= offset_y * (scale_change - 1)

        # 只清除相关的缓存，而不是全部清除
        keys_to_remove = [key for key in self._cached_images.keys() 
                         if key[1] != self.map_scale]  # 清除不同缩放比例的缓存
        for key in keys_to_remove:
            del self._cached_images[key]
        return True

    def start_drag(self, x: int, y: int):
        """开始拖拽"""
        self.drag_start = (x, y)

    def drag_map(self, x: int, y: int) -> bool:
        """拖拽地图"""
        if not self.drag_start:
            return False

        dx = x - self.drag_start[0]
        dy = y - self.drag_start[1]

        self.map_offset[0] += dx
        self.map_offset[1] += dy

        self.drag_start = (x, y)
        
        # 拖拽时不清除缓存，保持流畅性
        return True

    def render_map_to_canvas(self, map_image: Image.Image, canvas_width: int,
                             canvas_height: int) -> Optional[ImageTk.PhotoImage]:
        """将地图渲染到画布尺寸"""
        if canvas_width <= 1 or canvas_height <= 1:
            return None

        # 创建缓存键 - 包含图像内容的哈希值，确保内容变化时缓存失效
        try:
            # 使用图像数据的哈希作为缓存键的一部分
            image_hash = hash(map_image.tobytes())
            cache_key = (image_hash, self.map_scale, canvas_width, canvas_height)
        except Exception:
            # 如果无法获取哈希，使用图像尺寸
            cache_key = (map_image.size, self.map_scale, canvas_width, canvas_height)

        if cache_key in self._cached_images:
            return self._cached_images[cache_key]

        try:
            # 计算缩放后的尺寸
            new_width = int(map_image.width * self.map_scale)
            new_height = int(map_image.height * self.map_scale)

            if new_width < 1 or new_height < 1:
                return None

            # 性能优化：限制最大渲染尺寸以避免内存问题
            max_size = 2048
            if new_width > max_size or new_height > max_size:
                scale_factor = min(max_size / new_width, max_size / new_height)
                new_width = int(new_width * scale_factor)
                new_height = int(new_height * scale_factor)
                self.logger.log(f"地图尺寸过大，已缩放到: {new_width}x{new_height}", "WARN")

            # 优化：对于大图像，使用更快的缩放算法
            if new_width > 1000 or new_height > 1000:
                resized_image = map_image.resize((new_width, new_height), Image.BILINEAR)
            else:
                resized_image = map_image.resize((new_width, new_height), Image.LANCZOS)

            # 转换为Tkinter图像
            tk_image = ImageTk.PhotoImage(resized_image)

            # 缓存结果（限制缓存大小以避免内存问题）
            if len(self._cached_images) > 10:
                # 清除最旧的缓存，但保留当前缩放比例的缓存
                keys_to_remove = []
                for key in self._cached_images.keys():
                    if len(key) >= 2 and key[1] != self.map_scale:
                        keys_to_remove.append(key)
                
                # 如果还有空间，清除一些旧缓存
                if len(keys_to_remove) < 5:
                    oldest_key = next(iter(self._cached_images))
                    if oldest_key not in keys_to_remove:
                        keys_to_remove.append(oldest_key)
                
                for key in keys_to_remove:
                    del self._cached_images[key]
            
            self._cached_images[cache_key] = tk_image

            return tk_image

        except Exception as e:
            self.logger.log(f"渲染地图失败: {e}", "ERROR")
            # 返回一个默认的黑色图像，避免地图消失
            try:
                default_image = Image.new('RGB', (canvas_width, canvas_height), (0, 0, 0))
                return ImageTk.PhotoImage(default_image)
            except Exception:
                return None

    def fit_map_to_canvas(self, canvas_size: Tuple[int, int], map_size: Optional[Tuple[int, int]] = None) -> bool:
        """将地图自适应到画布"""
        canvas_width, canvas_height = canvas_size
        if canvas_width <= 1 or canvas_height <= 1:
            return False

        # 获取原始地图尺寸
        if map_size:
            map_width, map_height = map_size
        else:
            # 使用默认值
            map_width = 1024
            map_height = 1024

        # 计算适合画布的缩放比例
        scale_x = canvas_width / map_width
        scale_y = canvas_height / map_height
        new_scale = min(scale_x, scale_y, self.map_max_scale)

        if new_scale != self.map_scale:
            self.map_scale = new_scale
            self.map_offset = [0, 0]
            self._cached_images.clear()
            self.logger.log(f"地图自适应缩放: {new_scale:.2f}", "INFO")
            return True
        return False

    def maximize_map(self) -> bool:
        """显示地图原始大小"""
        if self.map_scale != 1.0:
            self.map_scale = 1.0
            self.map_offset = [0, 0]
            self._cached_images.clear()
            self.logger.log("地图显示原始大小", "INFO")
            return True
        return False

    def get_current_view_image(self, map_image: Image.Image, canvas_size: Tuple[int, int]) -> Optional[Image.Image]:
        """获取当前视图的图像"""
        canvas_width, canvas_height = canvas_size
        if canvas_width <= 1 or canvas_height <= 1:
            return None

        try:
            # 渲染到画布尺寸
            rendered_image = self.render_map_to_canvas(map_image, canvas_width, canvas_height)
            if not rendered_image:
                return None

            # 创建画布大小的图像
            canvas_image = Image.new('RGBA', (canvas_width, canvas_height), (0, 0, 0, 0))
            
            # 计算绘制位置
            center_x = canvas_width // 2 + self.map_offset[0]
            center_y = canvas_height // 2 + self.map_offset[1]
            
            # 获取渲染图像的PIL图像
            # 这里需要从ImageTk转换回PIL图像，暂时返回None
            # 实际实现需要更复杂的处理
            return None

        except Exception as e:
            self.logger.log(f"获取当前视图图像失败: {e}", "ERROR")
            return None

    def toggle_reference_lines(self):
        """切换参考线显示"""
        self.show_reference_lines = not self.show_reference_lines
        self.logger.log(f"参考线显示: {'开启' if self.show_reference_lines else '关闭'}", "INFO")

    def get_reference_lines(self, canvas_width: int, canvas_height: int) -> List[Tuple[int, int, int, int]]:
        """获取参考线坐标"""
        if not self.show_reference_lines:
            return []
        
        lines = []
        center_x = canvas_width // 2
        center_y = canvas_height // 2
        
        # 垂直线（中心线）
        lines.append((center_x, 0, center_x, canvas_height))
        
        # 水平线（中心线）
        lines.append((0, center_y, canvas_width, center_y))
        
        return lines

    def set_background_color(self, color: str):
        """设置背景颜色"""
        self.background_type = "color"
        self.background_color = color
        self.logger.log(f"设置背景颜色: {color}", "INFO")

    def set_background_transparent(self):
        """设置透明背景"""
        self.background_type = "transparent"
        self.logger.log("设置透明背景", "INFO")

    def set_background_image(self, image_path: str):
        """设置背景图片"""
        try:
            self.background_image = Image.open(image_path)
            self.background_type = "image"
            self.logger.log(f"设置背景图片: {image_path}", "INFO")
        except Exception as e:
            self.logger.log(f"设置背景图片失败: {e}", "ERROR")

    def get_background_info(self) -> dict:
        """获取背景信息"""
        return {
            "type": self.background_type,
            "color": self.background_color,
            "image": self.background_image
        }