# src/models/map_data.py - 修复导入
import os
from typing import List, Tuple, Dict, Optional
from PIL import Image, ImageDraw, ImageTk
from .sprite_types import CellType

# 其余代码保持不变...


class MapData:
    """地图数据容器"""

    def __init__(self, name: str, image_path: str = "", config: dict = None, tiles: List[Tuple[int, int, str]] = None, config_manager=None):
        self.name = name
        self.image_path = image_path
        self.config = config or {}
        self.tiles = tiles or []
        self.config_manager = config_manager
        self.cells = self.config.get("cells", [])
        self.width = self.config.get("width", 0)
        self.height = self.config.get("height", 0)

        # 如果没有明确的宽高，尝试推算
        if self.width == 0 or self.height == 0:
            side = int(len(self.cells) ** 0.5)
            if side * side == len(self.cells):
                self.width = self.height = side

        self._base_image = None
        self._rendered_images = {}
        self._map_image = None  # 新增：地图图片

    def get_map_image(self) -> Optional[Image.Image]:
        """获取地图图片"""
        if self._map_image is None:
            if self.image_path and os.path.exists(self.image_path):
                try:
                    self._map_image = Image.open(self.image_path)
                    print(f"成功加载地图图片: {self.image_path}")
                except Exception as e:
                    print(f"加载地图图片失败: {e}")
                    # 如果单个图片加载失败，尝试使用拼接的地图
                    if self.tiles:
                        self._map_image = self.get_base_image()
                    else:
                        # 创建空白地图
                        self._map_image = Image.new('RGBA', (800, 600), (128, 128, 128, 255))
            else:
                # 没有图片路径，优先使用拼接的地图
                if self.tiles:
                    self._map_image = self.get_base_image()
                else:
                    # 创建空白地图
                    self._map_image = Image.new('RGBA', (800, 600), (128, 128, 128, 255))
        return self._map_image

    def get_base_image(self) -> Image.Image:
        """获取基础地图图像（不含标记）"""
        if self._base_image is None:
            self._base_image = self._create_base_image()
        return self._base_image

    def get_rendered_image(self, show_walkable: bool = True, show_blocked: bool = True,
                           show_masked: bool = True) -> Image.Image:
        """获取渲染后的地图图像（含标记）"""
        cache_key = (show_walkable, show_blocked, show_masked)

        if cache_key not in self._rendered_images:
            try:
                # 如果所有标记都关闭，直接返回基础图像
                if not (show_walkable or show_blocked or show_masked):
                    return self.get_base_image()
                
                self._rendered_images[cache_key] = self._create_rendered_image(
                    show_walkable, show_blocked, show_masked
                )
            except Exception as e:
                print(f"创建渲染图像失败: {e}")
                print(f"地图名称: {self.name}, tiles数量: {len(self.tiles)}, cells数量: {len(self.cells)}")
                # 返回基础图像作为备选
                return self.get_base_image()

        return self._rendered_images[cache_key]

    def _create_base_image(self) -> Image.Image:
        """创建基础地图图像"""
        print(f"MapData: 开始创建基础地图图像，地图名称: {self.name}")
        print(f"MapData: 瓦片数量: {len(self.tiles)}")
        
        if not self.tiles:
            print("MapData: 没有瓦片数据，返回默认图像")
            return Image.new('RGBA', (800, 600), (128, 128, 128, 255))

        # 分析所有切片的尺寸，找到最大尺寸作为标准
        tile_sizes = []
        for row, col, file_path in self.tiles:
            try:
                tile_img = Image.open(file_path)
                tile_sizes.append(tile_img.size)
            except Exception as e:
                print(f"分析切片尺寸失败: {file_path}, 错误: {e}")
                continue
        
        if not tile_sizes:
            print("没有有效的切片文件")
            return Image.new('RGBA', (800, 600), (128, 128, 128, 255))
        
        # 使用最大尺寸作为标准尺寸
        max_width = max(size[0] for size in tile_sizes)
        max_height = max(size[1] for size in tile_sizes)
        standard_tile_width, standard_tile_height = max_width, max_height
        
        print(f"标准切片尺寸: {standard_tile_width}x{standard_tile_height}")

        # 计算完整地图尺寸 - 根据实际的最大行列值
        try:
            max_row = max(t[0] for t in self.tiles)
            max_col = max(t[1] for t in self.tiles)
        except ValueError as e:
            print(f"计算地图尺寸失败，tiles为空或格式错误: {e}")
            return Image.new('RGBA', (800, 600), (128, 128, 128, 255))
        
        # 计算实际的地图尺寸（从0开始，所以需要+1）
        map_width = (max_col + 1) * standard_tile_width
        map_height = (max_row + 1) * standard_tile_height
        
        print(f"地图尺寸: {map_width}x{map_height}")

        # 创建完整地图
        big_map = Image.new('RGBA', (map_width, map_height), (0, 0, 0, 0))

        # 记录实际内容区域
        min_x, min_y = float('inf'), float('inf')
        max_x, max_y = 0, 0

        # 拼接地图切片
        print(f"MapData: 开始拼接 {len(self.tiles)} 个瓦片")
        successful_tiles = 0
        for row, col, file_path in self.tiles:
            try:
                tile_img = Image.open(file_path)
                
                # 计算粘贴位置 - 使用标准尺寸的网格
                paste_x = col * standard_tile_width
                paste_y = row * standard_tile_height
                
                # 粘贴切片（保持原始尺寸，不拉伸）
                big_map.paste(tile_img, (paste_x, paste_y))
                
                # 更新实际内容区域
                min_x = min(min_x, paste_x)
                min_y = min(min_y, paste_y)
                max_x = max(max_x, paste_x + tile_img.width)
                max_y = max(max_y, paste_y + tile_img.height)
                
                successful_tiles += 1
                
            except Exception as e:
                # 如果某个切片加载失败，跳过它
                print(f"加载地图切片失败: {file_path}, 错误: {e}")
                continue

        print(f"MapData: 瓦片拼接完成，成功: {successful_tiles}/{len(self.tiles)}")
        
        # 裁剪到实际内容区域，去除空白
        if min_x != float('inf') and min_y != float('inf'):
            actual_width = max_x - min_x
            actual_height = max_y - min_y
            if actual_width > 0 and actual_height > 0:
                big_map = big_map.crop((min_x, min_y, max_x, max_y))
                print(f"裁剪后尺寸: {actual_width}x{actual_height}")
        else:
            print("MapData: 没有有效的内容区域，使用完整地图")

        print(f"MapData: 基础地图图像创建完成，最终尺寸: {big_map.size}")
        return big_map

    def _create_rendered_image(self, show_walkable: bool, show_blocked: bool,
                               show_masked: bool) -> Image.Image:
        """创建带标记的地图图像"""
        base_image = self.get_base_image()

        if not (show_walkable or show_blocked or show_masked):
            return base_image.copy()

        # 创建透明覆盖层
        overlay = Image.new('RGBA', base_image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # 计算每个逻辑格子的像素尺寸 - 基于实际地图尺寸
        if self.width > 0 and self.height > 0 and len(self.cells) > 0:
            # 使用逻辑格子数量来计算格子大小，但限制在实际地图范围内
            # 从文件名中提取最大行列值
            try:
                max_row = max(t[0] for t in self.tiles)
                max_col = max(t[1] for t in self.tiles)
                actual_width = max_col + 1  # 从0开始，所以+1
                actual_height = max_row + 1
            except ValueError:
                # 如果tiles为空，使用默认值
                actual_width = self.width if self.width > 0 else 10
                actual_height = self.height if self.height > 0 else 10
            
            # 使用逻辑格子数量来计算格子大小
            cell_width = base_image.width / self.width
            cell_height = base_image.height / self.height

            # 优化：只绘制需要显示的标记类型
            walkable_cells = []
            blocked_cells = []
            masked_cells = []

            # 预先分类所有格子 - 遍历整个cells数组
            walkable_count = 0
            blocked_count = 0
            masked_count = 0
            
            for y in range(self.height):
                for x in range(self.width):
                    idx = y * self.width + x
                    if idx < len(self.cells):
                        cell_value = self.cells[idx]
                        
                        # 计算格子的像素坐标 - 确保不超出地图边界
                        x1 = int(x * cell_width)
                        y1 = int(y * cell_height)
                        x2 = int((x + 1) * cell_width)
                        y2 = int((y + 1) * cell_height)
                        
                        # 确保坐标不超出地图边界
                        x2 = min(x2, base_image.width)
                        y2 = min(y2, base_image.height)
                        
                        # 确保坐标有效且在地图范围内
                        if x1 < x2 and y1 < y2 and x1 >= 0 and y1 >= 0:
                            if cell_value == CellType.WALKABLE.value and show_walkable:
                                walkable_cells.append((x1, y1, x2, y2))
                                walkable_count += 1
                            elif cell_value == CellType.BLOCKED.value and show_blocked:
                                blocked_cells.append((x1, y1, x2, y2))
                                blocked_count += 1
                            elif cell_value == CellType.MASKED.value and show_masked:
                                masked_cells.append((x1, y1, x2, y2))
                                masked_count += 1

            # 获取配置的颜色和透明度
            if self.config_manager:
                colors = self.config_manager.get_map_marker_colors()
                alpha = int(self.config_manager.get_map_marker_alpha() * 255)
            else:
                colors = {
                    'walkable': '#00FF00',
                    'blocked': '#FF0000',
                    'masked': '#0000FF'
                }
                alpha = 76  # 默认透明度 30%
            
            # 批量绘制相同类型的标记
            if walkable_cells:
                color = colors.get('walkable', '#00FF00')
                rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))  # 转换#RRGGBB为RGB
                for x1, y1, x2, y2 in walkable_cells:
                    draw.rectangle([x1, y1, x2, y2], fill=(*rgb, alpha))
            
            if blocked_cells:
                color = colors.get('blocked', '#FF0000')
                rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))  # 转换#RRGGBB为RGB
                for x1, y1, x2, y2 in blocked_cells:
                    draw.rectangle([x1, y1, x2, y2], fill=(*rgb, alpha))
            
            if masked_cells:
                color = colors.get('masked', '#0000FF')
                rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))  # 转换#RRGGBB为RGB
                for x1, y1, x2, y2 in masked_cells:
                    draw.rectangle([x1, y1, x2, y2], fill=(*rgb, alpha))

        # 合成最终图像
        return Image.alpha_composite(base_image.convert('RGBA'), overlay)

    def clear_cache(self):
        """清除图像缓存"""
        self._rendered_images.clear()
    
    def clear_mark_cache(self):
        """只清除标记相关的缓存，保留基础图像缓存"""
        keys_to_remove = []
        for key in self._rendered_images.keys():
            # 保留基础图像缓存（所有标记都为False的情况）
            if key != (False, False, False):
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self._rendered_images[key]