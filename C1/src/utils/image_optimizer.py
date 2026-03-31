# src/utils/image_optimizer.py - 图像处理优化系统
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
from typing import Tuple, Optional, Dict, Any
import threading
import queue


class ImageOptimizer:
    """图像处理优化系统"""
    
    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.max_image_size = config_manager.get('performance.max_image_size', 4096)
        self.quality = config_manager.get('image.quality', 95)
        self.progressive_loading = config_manager.get('performance.enable_progressive_loading', True)
        
        # 图像处理队列
        self.processing_queue = queue.Queue()
        self.processing_thread = threading.Thread(target=self._processing_worker, daemon=True)
        self.processing_thread.start()
    
    def optimize_for_display(self, image: Image.Image, max_size: Tuple[int, int] = None) -> Image.Image:
        """优化图像用于显示"""
        if max_size is None:
            max_size = (self.max_image_size, self.max_image_size)
        
        # 检查图像尺寸
        if image.width > max_size[0] or image.height > max_size[1]:
            # 计算缩放比例
            scale_x = max_size[0] / image.width
            scale_y = max_size[1] / image.height
            scale = min(scale_x, scale_y)
            
            # 缩放图像
            new_width = int(image.width * scale)
            new_height = int(image.height * scale)
            image = image.resize((new_width, new_height), Image.LANCZOS)
        
        return image
    
    def progressive_load(self, image_path: str, callback: callable = None) -> Image.Image:
        """渐进式加载图像"""
        if not self.progressive_loading:
            return Image.open(image_path)
        
        # 创建低质量预览
        with Image.open(image_path) as img:
            # 创建缩略图作为预览
            preview = img.copy()
            preview.thumbnail((256, 256), Image.LANCZOS)
            
            if callback:
                callback(preview, "preview")
        
        # 异步加载完整图像
        def load_full_image():
            try:
                full_image = Image.open(image_path)
                if callback:
                    callback(full_image, "full")
            except Exception as e:
                print(f"加载完整图像失败: {e}")
        
        # 将任务添加到处理队列
        self.processing_queue.put(load_full_image)
        
        return preview
    
    def enhance_image(self, image: Image.Image, 
                     brightness: float = 1.0,
                     contrast: float = 1.0,
                     saturation: float = 1.0,
                     sharpness: float = 1.0) -> Image.Image:
        """增强图像质量"""
        enhanced = image.copy()
        
        # 亮度调整
        if brightness != 1.0:
            enhancer = ImageEnhance.Brightness(enhanced)
            enhanced = enhancer.enhance(brightness)
        
        # 对比度调整
        if contrast != 1.0:
            enhancer = ImageEnhance.Contrast(enhanced)
            enhanced = enhancer.enhance(contrast)
        
        # 饱和度调整
        if saturation != 1.0:
            enhancer = ImageEnhance.Color(enhanced)
            enhanced = enhancer.enhance(saturation)
        
        # 锐度调整
        if sharpness != 1.0:
            enhancer = ImageEnhance.Sharpness(enhanced)
            enhanced = enhancer.enhance(sharpness)
        
        return enhanced
    
    def apply_filters(self, image: Image.Image, filters: Dict[str, Any]) -> Image.Image:
        """应用图像滤镜"""
        filtered = image.copy()
        
        for filter_name, params in filters.items():
            if filter_name == "blur" and params > 0:
                filtered = filtered.filter(ImageFilter.GaussianBlur(params))
            elif filter_name == "sharpen":
                filtered = filtered.filter(ImageFilter.SHARPEN)
            elif filter_name == "emboss":
                filtered = filtered.filter(ImageFilter.EMBOSS)
            elif filter_name == "edge_enhance":
                filtered = filtered.filter(ImageFilter.EDGE_ENHANCE)
            elif filter_name == "find_edges":
                filtered = filtered.filter(ImageFilter.FIND_EDGES)
        
        return filtered
    
    def create_thumbnail(self, image: Image.Image, size: Tuple[int, int]) -> Image.Image:
        """创建缩略图"""
        thumbnail = image.copy()
        thumbnail.thumbnail(size, Image.LANCZOS)
        return thumbnail
    
    def optimize_for_export(self, image: Image.Image, format: str = "PNG") -> Image.Image:
        """优化图像用于导出"""
        optimized = image.copy()
        
        # 根据格式进行优化
        if format.upper() == "JPEG":
            # JPEG优化：转换为RGB模式
            if optimized.mode in ('RGBA', 'LA', 'P'):
                # 创建白色背景
                background = Image.new('RGB', optimized.size, (255, 255, 255))
                if optimized.mode == 'P':
                    optimized = optimized.convert('RGBA')
                background.paste(optimized, mask=optimized.split()[-1] if optimized.mode == 'RGBA' else None)
                optimized = background
            elif optimized.mode != 'RGB':
                optimized = optimized.convert('RGB')
        
        return optimized
    
    def batch_process(self, images: list, operation: str, **kwargs) -> list:
        """批量处理图像"""
        results = []
        
        for image in images:
            try:
                if operation == "enhance":
                    result = self.enhance_image(image, **kwargs)
                elif operation == "filter":
                    result = self.apply_filters(image, **kwargs)
                elif operation == "optimize":
                    result = self.optimize_for_display(image, **kwargs)
                else:
                    result = image
                
                results.append(result)
            except Exception as e:
                print(f"批量处理图像失败: {e}")
                results.append(image)
        
        return results
    
    def _processing_worker(self):
        """图像处理工作线程"""
        while True:
            try:
                task = self.processing_queue.get(timeout=1)
                if task:
                    task()
                self.processing_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                print(f"图像处理工作线程错误: {e}")
    
    def get_image_info(self, image: Image.Image) -> Dict[str, Any]:
        """获取图像信息"""
        return {
            'size': image.size,
            'mode': image.mode,
            'format': getattr(image, 'format', None),
            'width': image.width,
            'height': image.height,
            'aspect_ratio': image.width / image.height if image.height > 0 else 0,
            'file_size_estimate': self._estimate_file_size(image)
        }
    
    def _estimate_file_size(self, image: Image.Image) -> int:
        """估算文件大小"""
        # 简单的文件大小估算
        if image.mode == 'RGBA':
            bytes_per_pixel = 4
        elif image.mode == 'RGB':
            bytes_per_pixel = 3
        else:
            bytes_per_pixel = 1
        
        return image.width * image.height * bytes_per_pixel
    
    def create_image_pyramid(self, image: Image.Image, levels: int = 4) -> list:
        """创建图像金字塔（多分辨率）"""
        pyramid = [image]
        
        for i in range(1, levels):
            # 每次缩小一半
            prev_level = pyramid[-1]
            new_width = prev_level.width // 2
            new_height = prev_level.height // 2
            
            if new_width > 0 and new_height > 0:
                level = prev_level.resize((new_width, new_height), Image.LANCZOS)
                pyramid.append(level)
            else:
                break
        
        return pyramid
    
    def smart_resize(self, image: Image.Image, target_size: Tuple[int, int], 
                    preserve_aspect: bool = True) -> Image.Image:
        """智能缩放图像"""
        if preserve_aspect:
            # 保持宽高比
            scale_x = target_size[0] / image.width
            scale_y = target_size[1] / image.height
            scale = min(scale_x, scale_y)
            
            new_width = int(image.width * scale)
            new_height = int(image.height * scale)
            target_size = (new_width, new_height)
        
        return image.resize(target_size, Image.LANCZOS)
    
    def create_tile_grid(self, image: Image.Image, tile_size: Tuple[int, int]) -> list:
        """将图像分割为网格"""
        tiles = []
        width, height = image.size
        tile_width, tile_height = tile_size
        
        for y in range(0, height, tile_height):
            for x in range(0, width, tile_width):
                # 计算实际切片大小
                actual_width = min(tile_width, width - x)
                actual_height = min(tile_height, height - y)
                
                if actual_width > 0 and actual_height > 0:
                    tile = image.crop((x, y, x + actual_width, y + actual_height))
                    tiles.append(tile)
        
        return tiles
    
    def merge_tiles(self, tiles: list, grid_size: Tuple[int, int], 
                   tile_size: Tuple[int, int]) -> Image.Image:
        """合并图像网格"""
        grid_width, grid_height = grid_size
        tile_width, tile_height = tile_size
        
        # 创建合并后的图像
        merged_width = grid_width * tile_width
        merged_height = grid_height * tile_height
        merged_image = Image.new('RGBA', (merged_width, merged_height), (0, 0, 0, 0))
        
        for i, tile in enumerate(tiles):
            if i >= grid_width * grid_height:
                break
            
            # 计算位置
            row = i // grid_width
            col = i % grid_width
            x = col * tile_width
            y = row * tile_height
            
            # 粘贴切片
            merged_image.paste(tile, (x, y))
        
        return merged_image 