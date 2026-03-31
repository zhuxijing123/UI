# src/utils/sprite_splitter.py - 素材拆图工具
import os
import json
from typing import List, Tuple, Dict
from PIL import Image
from ..models.sprite_types import SpriteType, ActionType, DirectionType
from ..models.sprite_manager import SpriteManager
from ..models.sprite_data import AnimationFrame


class SpriteSplitter:
    """素材拆图工具"""
    
    def __init__(self, logger):
        self.logger = logger
        
    def split_single_sprite(self, sprite_manager: SpriteManager, sprite_type: str, 
                           sprite_id: str, output_dir: str) -> bool:
        """拆分单个素材"""
        try:
            # 创建输出目录
            sprite_dir = os.path.join(output_dir, sprite_id)
            os.makedirs(sprite_dir, exist_ok=True)
            placements_dir = os.path.join(sprite_dir, "Placements")
            os.makedirs(placements_dir, exist_ok=True)
            
            frame_count = 0
            
            # 获取素材目录路径
            base_dir = self._get_sprite_base_dir(sprite_manager, sprite_type, sprite_id)
            if not base_dir or not os.path.exists(base_dir):
                self.logger.log(f"素材目录不存在: {base_dir}", "ERROR")
                return False
            
            # 遍历目录中的所有PNG文件
            png_files = [f for f in os.listdir(base_dir) if f.endswith('.png')]
            png_files.sort()  # 确保顺序一致
            
            for png_file in png_files:
                png_path = os.path.join(base_dir, png_file)
                json_file = png_file.replace('.png', '.json')
                json_path = os.path.join(base_dir, json_file)
                
                if not os.path.exists(json_path):
                    self.logger.log(f"JSON文件不存在: {json_path}", "WARN")
                    continue
                
                # 获取文件名前缀（如00、01、20等）
                prefix = png_file.replace('.png', '')
                
                # 加载PNG和JSON文件
                frames = self._load_frames_from_files(png_path, json_path)
                
                if frames:
                    # 保存每个小图
                    for i, frame in enumerate(frames):
                        frame_count += 1
                        
                        # 生成文件名：原文件名+序号
                        frame_filename = f"{prefix}{i+1:02d}.png"
                        placement_filename = f"{prefix}{i+1:02d}.txt"
                        
                        frame_path = os.path.join(sprite_dir, frame_filename)
                        placement_path = os.path.join(placements_dir, placement_filename)
                        
                        # 保存图片
                        frame.image.save(frame_path)
                        
                        # 保存偏移数据
                        placement_data = {
                            "offset_x": frame.offset_x,
                            "offset_y": frame.offset_y,
                            "source_file": png_file,
                            "frame_index": i
                        }
                        
                        with open(placement_path, 'w', encoding='utf-8') as f:
                            json.dump(placement_data, f, indent=2, ensure_ascii=False)
                        
                        self.logger.log(f"保存帧 {frame_count}: {frame_filename} -> {frame_path}", "DEBUG")
            
            self.logger.log(f"拆分完成: {sprite_type} - {sprite_id}, 共 {frame_count} 帧", "INFO")
            return True
            
        except Exception as e:
            self.logger.log(f"拆分素材失败: {e}", "ERROR")
            return False
    
    def _get_sprite_base_dir(self, sprite_manager: SpriteManager, sprite_type: str, sprite_id: str) -> str:
        """获取素材基础目录路径"""
        base_path = sprite_manager.base_path
        if sprite_type == "scene":
            return os.path.join(base_path, "scene", "0", sprite_id)
        elif sprite_type == "map":
            return os.path.join(base_path, "map", sprite_id)
        else:
            return os.path.join(base_path, sprite_type, sprite_id)
    
    def _load_frames_from_files(self, png_file: str, json_file: str) -> List[AnimationFrame]:
        """从PNG和JSON文件加载帧数据"""
        try:
            from PIL import Image
            import json
            
            if not os.path.exists(png_file) or not os.path.exists(json_file):
                return []
            
            # 加载精灵表
            sheet = Image.open(png_file)
            
            # 加载帧配置
            with open(json_file, 'r', encoding='utf-8') as f:
                frame_configs = json.load(f)
            
            # 处理不同的JSON格式
            if isinstance(frame_configs, dict):
                if 'frames' in frame_configs:
                    frame_configs = frame_configs['frames']
                elif 'sprites' in frame_configs:
                    frame_configs = frame_configs['sprites']
                else:
                    frame_configs = [frame_configs]
            elif isinstance(frame_configs, list):
                if len(frame_configs) >= 6 and all(isinstance(item, (list, int)) for item in frame_configs[:6]):
                    frame_configs = [frame_configs]
                else:
                    pass  # 保持原样
            else:
                frame_configs = [frame_configs]
            
            # 创建帧对象
            frames = []
            for i, config in enumerate(frame_configs):
                if isinstance(config, list) and len(config) >= 6:
                    # 新格式: [[x1,x2...], [y1,y2...], [w1,w2...], [h1,h2...], [offset_x1,offset_x2...], [offset_y1,offset_y2...], unused]
                    x_list = config[0]
                    y_list = config[1]
                    w_list = config[2]
                    h_list = config[3]
                    offset_x_list = config[4]
                    offset_y_list = config[5]
                    
                    # 为每个帧创建AnimationFrame
                    for j in range(len(x_list)):
                        if j < len(x_list) and j < len(y_list) and j < len(w_list) and j < len(h_list):
                            a = x_list[j]
                            b = y_list[j]
                            c = w_list[j]
                            d = h_list[j]
                            e = offset_x_list[j] if j < len(offset_x_list) else 0
                            f = offset_y_list[j] if j < len(offset_y_list) else 0
                            
                            # 计算偏移
                            offset_x = e + c * 0.5
                            offset_y = -f - d * 0.5
                            
                            if c > 0 and d > 0:
                                # 裁剪图像
                                sprite = sheet.crop((a, b, a + c, b + d))
                                frame = AnimationFrame(sprite, 100, "down", "stand", offset_x, offset_y)
                                frames.append(frame)
                else:
                    # 旧格式或其他格式
                    try:
                        frame = AnimationFrame.from_config(sheet, config)
                        if frame:
                            frames.append(frame)
                    except:
                        continue
            
            return frames
            
        except Exception as e:
            self.logger.log(f"加载帧失败: {e}", "ERROR")
            return []
    
    def split_all_sprites(self, sprite_manager: SpriteManager, sprite_type: str, 
                         output_dir: str) -> Dict[str, bool]:
        """拆分指定类型的所有素材"""
        results = {}
        
        # 获取所有ID
        sprite_ids = sprite_manager.get_sprite_ids(sprite_type)
        self.logger.log(f"开始拆分 {sprite_type} 类型素材，共 {len(sprite_ids)} 个", "INFO")
        
        for sprite_id in sprite_ids:
            success = self.split_single_sprite(sprite_manager, sprite_type, sprite_id, output_dir)
            results[sprite_id] = success
            
            if success:
                self.logger.log(f"拆分成功: {sprite_id}", "INFO")
            else:
                self.logger.log(f"拆分失败: {sprite_id}", "ERROR")
        
        # 统计结果
        success_count = sum(1 for success in results.values() if success)
        total_count = len(results)
        
        self.logger.log(f"拆分完成: {sprite_type} 类型，成功 {success_count}/{total_count}", "INFO")
        return results
    
    def get_split_info(self, sprite_manager: SpriteManager, sprite_type: str, 
                      sprite_id: str = None) -> dict:
        """获取拆分信息"""
        info = {
            "sprite_type": sprite_type,
            "total_sprites": 0,
            "total_frames": 0,
            "estimated_size": "0 MB"
        }
        
        if sprite_id:
            # 单个素材信息
            if sprite_manager.load_sprite(sprite_type, sprite_id):
                sprite_data = sprite_manager.get_current_sprite_data()
                if sprite_data:
                    frame_count = sum(len(frames) for frames in sprite_data.frames_data.values())
                    info["total_frames"] = frame_count
                    info["estimated_size"] = f"{frame_count * 0.1:.1f} MB"  # 估算
        else:
            # 所有素材信息
            sprite_ids = sprite_manager.get_sprite_ids(sprite_type)
            info["total_sprites"] = len(sprite_ids)
            
            # 估算总帧数
            estimated_frames = len(sprite_ids) * 32  # 假设每个素材平均32帧
            info["total_frames"] = estimated_frames
            info["estimated_size"] = f"{estimated_frames * 0.1:.1f} MB"  # 估算
        
        return info 