# src/models/sprite_data.py - 修复导入
from typing import Dict, List, Optional
from PIL import Image, ImageTk
from .sprite_types import SpriteType, ActionType, DirectionType

# 其余代码保持不变...

class AnimationFrame:
    """动画帧数据"""

    def __init__(self, image: Image.Image, duration: int = 100, direction: str = "down", action: str = "stand", offset_x: int = 0, offset_y: int = 0):
        self.image = image
        self.duration = duration
        self.direction = direction
        self.action = action
        self.offset_x = offset_x
        self.offset_y = offset_y
        self._tk_image = None

    @classmethod
    def from_config(cls, sheet: Image.Image, config: dict, mirror: bool = False) -> Optional['AnimationFrame']:
        """从配置创建动画帧"""
        try:
            # 检查是否是新的数组格式
            if isinstance(config, list) and len(config) >= 6:
                # 新格式: [[x1,x2...], [y1,y2...], [w1,w2...], [h1,h2...], [offset_x1,offset_x2...], [offset_y1,offset_y2...], unused]
                x_list = config[0]
                y_list = config[1]
                w_list = config[2]
                h_list = config[3]
                offset_x_list = config[4]
                offset_y_list = config[5]
                
                # 使用第一个帧的数据
                a = x_list[0] if x_list else 0  # 小图在大图中的起始x坐标
                b = y_list[0] if y_list else 0  # 小图在大图中的起始y坐标
                c = w_list[0] if w_list else 0  # 小图的宽度
                d = h_list[0] if h_list else 0  # 小图的高度
                e = offset_x_list[0] if offset_x_list else 0  # x偏移
                f = offset_y_list[0] if offset_y_list else 0  # y偏移
                
                # 根据公式计算最终偏移
                offset_x = e + c * 0.5
                offset_y = -f - d * 0.5
            else:
                # 旧格式: {x, y, w, h, cx, cy}
                a = config.get('x', 0)
                b = config.get('y', 0)
                c = config.get('w', 0)
                d = config.get('h', 0)
                offset_x = config.get('cx', 0)
                offset_y = config.get('cy', 0)

            if c <= 0 or d <= 0:
                return None

            # 裁剪图像
            sprite = sheet.crop((a, b, a + c, b + d))

            # 镜像处理
            if mirror:
                sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
                offset_x = -offset_x

            return cls(sprite, 100, "down", "stand", offset_x, offset_y)

        except Exception as e:
            # 这里无法直接访问logger，所以返回None
            return None

    def get_tk_image(self) -> ImageTk.PhotoImage:
        """获取Tkinter可用的图像"""
        if self._tk_image is None:
            self._tk_image = ImageTk.PhotoImage(self.image)
        return self._tk_image


class SpriteData:
    """精灵数据容器"""

    def __init__(self, sprite_type: str, sprite_id: str, frames: Optional[Dict[str, AnimationFrame]] = None):
        self.sprite_type = sprite_type
        self.sprite_id = sprite_id
        self.frames = frames or {}
        self.current_frame = 0
        self.current_direction = "down"
        self.current_action = "stand"  # 添加当前动作
        self.simple_images = []  # 用于存储简单图片路径
        
        # 统计帧数据
        if self.frames:
            total_frames = len(self.frames)
            print(f"创建精灵数据: {sprite_type} - {sprite_id}, 总帧数: {total_frames}")
            print(f"  帧文件: {list(self.frames.keys())}")

    def set_simple_images(self, image_paths: List[str]):
        """设置简单图片路径列表"""
        self.simple_images = image_paths
        print(f"设置简单图片: {self.sprite_type} - {self.sprite_id}, 图片数量: {len(image_paths)}")

    def get_simple_images(self) -> List[str]:
        """获取简单图片路径列表"""
        return self.simple_images

    def is_simple_images(self) -> bool:
        """检查是否为简单图片类型"""
        return len(self.simple_images) > 0 and len(self.frames) == 0

    def clear_cache(self):
        """清理缓存"""
        # 清理所有帧的缓存
        for frame in self.frames.values():
            frame._tk_image = None

    def get_frames(self, direction: str = None, action: str = None) -> List[AnimationFrame]:
        """获取指定方向和动作的帧列表"""
        if not self.frames:
            return []
        
        # 特殊处理：如果是human类型且请求死亡动画，不管选择哪个方向都返回60.png对应的帧
        if self.sprite_type == "human" and action == "death":
            # 查找60.png对应的帧
            death_frames = []
            for frame_key, frame in self.frames.items():
                if frame.action == "death" and "60.png" in frame_key:
                    death_frames.append(frame)
            
            if death_frames:
                # 返回所有死亡动画帧，不管方向
                return sorted(death_frames, key=lambda f: frame_key)
            else:
                # 如果没有找到60.png，返回所有死亡动画帧
                return [frame for frame in self.frames.values() if frame.action == "death"]
        
        # 常规处理：根据方向和动作筛选帧
        filtered_frames = []
        for frame in self.frames.values():
            # 检查方向匹配
            direction_match = direction is None or frame.direction == direction
            # 检查动作匹配
            action_match = action is None or frame.action == action
            
            if direction_match and action_match:
                filtered_frames.append(frame)
        
        # 按帧键排序，确保顺序一致
        filtered_frames.sort(key=lambda f: list(self.frames.keys())[list(self.frames.values()).index(f)])
        
        return filtered_frames

    def get_current_frame(self) -> Optional[AnimationFrame]:
        """获取当前帧"""
        frames = self.get_frames(self.current_direction, self.current_action)
        if frames and 0 <= self.current_frame < len(frames):
            return frames[self.current_frame]
        return None

    def get_frame_count(self, direction: str = None, action: str = None) -> int:
        """获取指定方向和动作的帧数量"""
        return len(self.get_frames(direction, action))

    def set_direction(self, direction: str):
        """设置当前方向"""
        self.current_direction = direction
        self.current_frame = 0

    def set_current_action(self, action: str):
        """设置当前动作"""
        self.current_action = action
        self.current_frame = 0  # 重置帧索引

    def set_frame(self, frame_index: int):
        """设置当前帧"""
        frames = self.get_frames(self.current_direction, self.current_action)
        if frames and 0 <= frame_index < len(frames):
            self.current_frame = frame_index

    def next_frame(self) -> int:
        """移动到下一帧"""
        frames = self.get_frames(self.current_direction, self.current_action)
        if frames:
            self.current_frame = (self.current_frame + 1) % len(frames)
        return self.current_frame

    def has_directions(self) -> bool:
        """检查是否有多个方向"""
        return len(self.frames) > 1

    def get_current_frame_index(self) -> int:
        """获取当前帧索引"""
        return self.current_frame