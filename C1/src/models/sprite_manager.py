# src/models/sprite_manager.py - 精灵数据管理器
import os
import json
from typing import List, Dict, Optional, Tuple
from PIL import Image
from .sprite_types import SpriteType, ActionType, DirectionType
from .sprite_data import SpriteData, AnimationFrame
from .map_data import MapData


class SpriteManager:
    """精灵数据管理器 - 负责所有素材的加载和管理"""

    def __init__(self, logger, config_manager=None):
        self.logger = logger
        self.config_manager = config_manager
        self.base_path = ""
        self.current_sprite_data: Optional[SpriteData] = None
        self.current_map_data: Optional[MapData] = None

    def set_base_path(self, path: str) -> bool:
        """设置素材根目录"""
        if os.path.exists(path):
            self.base_path = path
            self.logger.log(f"设置素材根目录: {path}", "INFO")
            return True
        else:
            self.logger.log(f"目录不存在: {path}", "ERROR")
            return False

    def get_sprite_types(self) -> List[str]:
        """获取可用的素材类型"""
        if not self.base_path:
            return []
        
        types = []
        if os.path.exists(os.path.join(self.base_path, "scene")):
            types.append("scene")
        if os.path.exists(os.path.join(self.base_path, "map")):
            types.append("map")
        if os.path.exists(os.path.join(self.base_path, "H5v", "map")):
            types.append("h5_map")
        return types

    def get_scene_subtypes(self) -> List[str]:
        """获取scene类型下的所有子类型"""
        if not self.base_path:
            self.logger.log("基础路径未设置", "WARN")
            return []
        
        scene_path = os.path.join(self.base_path, "scene")
        if not os.path.exists(scene_path):
            self.logger.log(f"场景路径不存在: {scene_path}", "WARN")
            return []
        
        subtypes = []
        try:
            for item in os.listdir(scene_path):
                item_path = os.path.join(scene_path, item)
                if os.path.isdir(item_path):
                    subtypes.append(item)
            subtypes = sorted(subtypes)
            self.logger.log(f"发现场景子类型: {len(subtypes)} 个", "INFO")
            return subtypes
        except Exception as e:
            self.logger.log(f"读取场景子类型失败: {e}", "ERROR")
            return []

    def get_sprite_ids(self, sprite_type: str, subtype: str = None) -> List[str]:
        """获取指定类型的所有精灵ID"""
        try:
            if sprite_type == "map":
                path = os.path.join(self.base_path, "map")
                if not os.path.exists(path):
                    return []
                # 地图类型返回文件夹名
                return sorted([d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d))])
            
            elif sprite_type == "h5_map":
                # H5地图类型：从battlemap/map目录获取地图ID列表
                path = os.path.join(self.base_path, "H5v", "map", "battlemap", "map")
                print(f"SpriteManager: 获取H5地图ID列表，路径: {path}")
                if not os.path.exists(path):
                    print(f"SpriteManager: H5地图路径不存在: {path}")
                    return []
                # 返回文件夹名作为地图ID
                ids = sorted([d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d))])
                print(f"SpriteManager: 找到H5地图ID数量: {len(ids)}，前10个: {ids[:10]}")
                return ids
            
            elif sprite_type == "scene" and subtype:
                path = os.path.join(self.base_path, "scene", subtype)
                if not os.path.exists(path):
                    return []
                
                # 特殊处理 icon 子类型：返回 “子目录-文件名(无扩展)” 作为ID
                if subtype == "icon":
                    return self._get_icon_ids(path)

                # 特殊处理 baizhanfeisheng 子类型
                if subtype == "baizhanfeisheng":
                    return self._get_baizhanfeisheng_ids(path)
                
                # 特殊处理 human 子类型
                if subtype == "human":
                    return self._get_human_ids(path)
                
                # 特殊处理 weapon 子类型
                if subtype == "weapon":
                    return self._get_weapon_ids(path)
                
                # 特殊处理 monster 子类型
                if subtype == "monster":
                    return self._get_monster_ids(path)
                
                # 特殊处理 skill 子类型
                if subtype == "skill":
                    return self._get_skill_ids(path)
                
                # 检查是否有子文件夹（素材ID）
                has_subfolders = any(os.path.isdir(os.path.join(path, item)) for item in os.listdir(path))
                
                if has_subfolders:
                    # 有子文件夹，默认返回子文件夹名作为素材ID（除特殊类型外）
                    return sorted([d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d))])
                else:
                    # 没有子文件夹，直接返回图片文件（去除扩展名）
                    image_files = [f for f in os.listdir(path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
                    return sorted([os.path.splitext(f)[0] for f in image_files])
            
            return []
            
        except Exception as e:
            self.logger.log(f"获取精灵ID列表失败: {e}", "ERROR")
            return []

    def _get_baizhanfeisheng_ids(self, path: str) -> List[str]:
        """特殊处理 baizhanfeisheng 子类型的ID生成"""
        try:
            ids = []
            # 遍历第一层目录（ID1）
            for id1 in os.listdir(path):
                id1_path = os.path.join(path, id1)
                if os.path.isdir(id1_path):
                    # 遍历第二层目录（ID2）
                    for id2 in os.listdir(id1_path):
                        id2_path = os.path.join(id1_path, id2)
                        if os.path.isdir(id2_path):
                            # 生成合并的ID号：ID1-ID2
                            combined_id = f"{id1}-{id2}"
                            ids.append(combined_id)
            
            self.logger.log(f"baizhanfeisheng 发现 {len(ids)} 个素材ID", "INFO")
            return sorted(ids)
            
        except Exception as e:
            self.logger.log(f"处理 baizhanfeisheng ID失败: {e}", "ERROR")
            return []

    def _get_icon_ids(self, path: str) -> List[str]:
        """特殊处理 icon 子类型的ID生成：子目录-文件名(无扩展)"""
        try:
            ids: List[str] = []
            # 遍历 icon 下的所有子目录，例如 activeicon、dressicon
            for subdir in os.listdir(path):
                subdir_path = os.path.join(path, subdir)
                if os.path.isdir(subdir_path):
                    # 列出该子目录下的所有图片文件
                    image_files = [
                        f for f in os.listdir(subdir_path)
                        if f.lower().endswith((".png", ".jpg", ".jpeg"))
                    ]
                    for img in image_files:
                        base_name = os.path.splitext(img)[0]
                        # 合并成 子目录-文件名 的形式
                        ids.append(f"{subdir}-{base_name}")
            self.logger.log(f"icon 发现 {len(ids)} 个素材ID", "INFO")
            return sorted(ids)
        except Exception as e:
            self.logger.log(f"处理 icon ID失败: {e}", "ERROR")
            return []

    def _get_human_ids(self, path: str) -> List[str]:
        """特殊处理 human 子类型的ID生成"""
        try:
            ids = []
            # 遍历human目录下的所有子目录（素材ID）
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path):
                    # 检查是否包含PNG文件（确保是有效的素材目录）
                    png_files = [f for f in os.listdir(item_path) if f.endswith('.png')]
                    if png_files:
                        ids.append(item)
            
            self.logger.log(f"human 发现 {len(ids)} 个素材ID", "INFO")
            return sorted(ids)
            
        except Exception as e:
            self.logger.log(f"处理 human ID失败: {e}", "ERROR")
            return []

    def _get_weapon_ids(self, path: str) -> List[str]:
        """特殊处理 weapon 子类型的ID生成"""
        try:
            ids = []
            # 遍历weapon目录下的所有子目录（素材ID）
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path):
                    # 检查是否包含PNG文件（确保是有效的素材目录）
                    png_files = [f for f in os.listdir(item_path) if f.endswith('.png')]
                    if png_files:
                        ids.append(item)
            
            self.logger.log(f"weapon 发现 {len(ids)} 个素材ID", "INFO")
            return sorted(ids)
            
        except Exception as e:
            self.logger.log(f"处理 weapon ID失败: {e}", "ERROR")
            return []

    def _get_monster_ids(self, path: str) -> List[str]:
        """特殊处理 monster 子类型的ID生成"""
        try:
            ids = []
            # 遍历monster目录下的所有子目录（素材ID）
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path):
                    # 检查是否包含PNG文件（确保是有效的素材目录）
                    png_files = [f for f in os.listdir(item_path) if f.endswith('.png')]
                    if png_files:
                        ids.append(item)
            
            self.logger.log(f"monster 发现 {len(ids)} 个素材ID", "INFO")
            return sorted(ids)
            
        except Exception as e:
            self.logger.log(f"处理 monster ID失败: {e}", "ERROR")
            return []

    def _get_skill_ids(self, path: str) -> List[str]:
        """特殊处理 skill 子类型的ID生成"""
        try:
            ids = []
            # 遍历skill目录下的所有子目录（素材ID）
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path):
                    # 检查是否包含PNG文件（确保是有效的素材目录）
                    png_files = [f for f in os.listdir(item_path) if f.endswith('.png')]
                    if png_files:
                        ids.append(item)
            
            self.logger.log(f"skill 发现 {len(ids)} 个素材ID", "INFO")
            return sorted(ids)
            
        except Exception as e:
            self.logger.log(f"处理 skill ID失败: {e}", "ERROR")
            return []

    def _load_baizhanfeisheng_sprite(self, path: str, sprite_id: str) -> bool:
        """特殊处理 baizhanfeisheng 子类型的素材加载"""
        try:
            # 解析合并的ID号：ID1-ID2
            if '-' not in sprite_id:
                self.logger.log(f"无效的 baizhanfeisheng ID格式: {sprite_id}", "ERROR")
                return False
            
            id1, id2 = sprite_id.split('-', 1)
            sprite_path = os.path.join(path, id1, id2)
            
            if not os.path.exists(sprite_path):
                self.logger.log(f"baizhanfeisheng 素材路径不存在: {sprite_path}", "ERROR")
                return False
            
            # 检查是否有JSON文件
            json_files = [f for f in os.listdir(sprite_path) if f.endswith('.json')]
            if json_files:
                # 有JSON文件，加载动画素材
                return self._load_animated_sprite(sprite_path, "baizhanfeisheng", sprite_id)
            else:
                # 没有JSON文件，加载静态图片
                return self._load_simple_images(sprite_path, "baizhanfeisheng", sprite_id)
                
        except Exception as e:
            self.logger.log(f"加载 baizhanfeisheng 素材失败: {e}", "ERROR")
            return False

    def _load_human_sprite(self, path: str, sprite_id: str) -> bool:
        """特殊处理 human 子类型的素材加载"""
        try:
            sprite_path = os.path.join(path, sprite_id)
            
            if not os.path.exists(sprite_path):
                self.logger.log(f"human 素材路径不存在: {sprite_path}", "ERROR")
                return False
            
            # 检查是否有JSON文件
            json_files = [f for f in os.listdir(sprite_path) if f.endswith('.json')]
            if json_files:
                # 有JSON文件，加载动画素材
                return self._load_human_animated_sprite(sprite_path, "human", sprite_id)
            else:
                # 没有JSON文件，加载静态图片
                return self._load_simple_images(sprite_path, "human", sprite_id)
                
        except Exception as e:
            self.logger.log(f"加载 human 素材失败: {e}", "ERROR")
            return False

    def _load_weapon_sprite(self, path: str, sprite_id: str) -> bool:
        """特殊处理 weapon 子类型的素材加载"""
        try:
            sprite_path = os.path.join(path, sprite_id)
            
            if not os.path.exists(sprite_path):
                self.logger.log(f"weapon 素材路径不存在: {sprite_path}", "ERROR")
                return False
            
            # 检查是否有JSON文件
            json_files = [f for f in os.listdir(sprite_path) if f.endswith('.json')]
            if json_files:
                # 有JSON文件，加载动画素材
                return self._load_weapon_animated_sprite(sprite_path, "weapon", sprite_id)
            else:
                # 没有JSON文件，加载静态图片
                return self._load_simple_images(sprite_path, "weapon", sprite_id)
                
        except Exception as e:
            self.logger.log(f"加载 weapon 素材失败: {e}", "ERROR")
            return False

    def _load_monster_sprite(self, path: str, sprite_id: str) -> bool:
        """特殊处理 monster 子类型的素材加载"""
        try:
            sprite_path = os.path.join(path, sprite_id)
            
            if not os.path.exists(sprite_path):
                self.logger.log(f"monster 素材路径不存在: {sprite_path}", "ERROR")
                return False
            
            # 检查是否有JSON文件
            json_files = [f for f in os.listdir(sprite_path) if f.endswith('.json')]
            if json_files:
                # 有JSON文件，加载动画素材
                return self._load_monster_animated_sprite(sprite_path, "monster", sprite_id)
            else:
                # 没有JSON文件，加载静态图片
                return self._load_simple_images(sprite_path, "monster", sprite_id)
                
        except Exception as e:
            self.logger.log(f"加载 monster 素材失败: {e}", "ERROR")
            return False

    def _load_skill_sprite(self, path: str, sprite_id: str) -> bool:
        """特殊处理 skill 子类型的素材加载"""
        try:
            sprite_path = os.path.join(path, sprite_id)
            
            if not os.path.exists(sprite_path):
                self.logger.log(f"skill 素材路径不存在: {sprite_path}", "ERROR")
                return False
            
            # 检查PNG文件数量来判断是否有方向
            png_files = [f for f in os.listdir(sprite_path) if f.endswith('.png')]
            json_files = [f for f in os.listdir(sprite_path) if f.endswith('.json')]
            
            if len(png_files) > 1:
                # 多个PNG文件，说明有方向，使用动画素材加载
                self.logger.log(f"skill {sprite_id} 检测到多方向: {len(png_files)} 个方向", "INFO")
                return self._load_skill_animated_sprite(sprite_path, "skill", sprite_id)
            else:
                # 只有一个PNG文件，说明没有方向，使用简单图片加载
                self.logger.log(f"skill {sprite_id} 检测到无方向", "INFO")
                if json_files:
                    # 有JSON文件，加载动画素材
                    return self._load_animated_sprite(sprite_path, "skill", sprite_id)
                else:
                    # 没有JSON文件，加载静态图片
                    return self._load_simple_images(sprite_path, "skill", sprite_id)
                
        except Exception as e:
            self.logger.log(f"加载 skill 素材失败: {e}", "ERROR")
            return False

    def load_sprite(self, sprite_type: str, subtype: str = None, sprite_id: str = None) -> bool:
        """加载精灵数据"""
        try:
            if sprite_type == "map":
                return self._load_map(sprite_id)
            elif sprite_type == "scene":
                return self._load_scene_sprite(subtype, sprite_id)
            return False
        except Exception as e:
            self.logger.log(f"加载精灵失败: {e}", "ERROR")
            return False

    def _load_map(self, map_id: str) -> bool:
        """加载地图数据"""
        try:
            map_path = os.path.join(self.base_path, "map", map_id)
            if not os.path.exists(map_path):
                self.logger.log(f"地图目录不存在: {map_path}", "ERROR")
                return False
            
            # 查找地图数据文件 - 支持多种格式
            map_data = None
            map_image_path = ""
            tiles = []
            
            # 优先查找mdata.json
            mdata_json_path = os.path.join(map_path, "mdata.json")
            if os.path.exists(mdata_json_path):
                with open(mdata_json_path, 'r', encoding='utf-8') as f:
                    map_data = json.load(f)
                self.logger.log(f"找到地图数据文件: mdata.json", "INFO")
            
            # 查找地图图片和切片 - 支持多种位置
            image_locations = [
                os.path.join(map_path, "image"),  # image子目录
                map_path,  # 直接在地图目录下
            ]
            
            # 首先尝试查找切片文件
            tiles_found = False
            for img_loc in image_locations:
                if os.path.exists(img_loc):
                    image_files = [f for f in os.listdir(img_loc) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
                    if image_files:
                        # 检查是否是切片文件（文件名包含下划线，如 0_0.jpg）
                        tile_files = [f for f in image_files if '_' in f and f.split('_')[0].isdigit() and f.split('_')[1].split('.')[0].isdigit()]
                        if tile_files:
                            # 找到切片文件，解析切片信息
                            for tile_file in sorted(tile_files):
                                try:
                                    # 解析文件名格式：row_col.jpg
                                    parts = tile_file.split('_')
                                    if len(parts) == 2:
                                        row = int(parts[0])
                                        col = int(parts[1].split('.')[0])
                                        tile_path = os.path.join(img_loc, tile_file)
                                        tiles.append((row, col, tile_path))
                                except (ValueError, IndexError):
                                    continue
                            
                            if tiles:
                                tiles_found = True
                                self.logger.log(f"找到 {len(tiles)} 个地图切片", "INFO")
                                break
                        else:
                            # 没有切片文件，尝试作为单个图片
                            # 优先选择较大的图片作为主图
                            image_files_with_size = []
                            for img_file in image_files:
                                try:
                                    img_path = os.path.join(img_loc, img_file)
                                    img = Image.open(img_path)
                                    image_files_with_size.append((img_file, img.size[0] * img.size[1]))
                                except:
                                    continue
                            
                            if image_files_with_size:
                                # 按图片大小排序，选择最大的
                                image_files_with_size.sort(key=lambda x: x[1], reverse=True)
                                selected_file = image_files_with_size[0][0]
                                map_image_path = os.path.join(img_loc, selected_file)
                                self.logger.log(f"找到地图图片: {map_image_path}", "INFO")
                                break
            
            # 如果没有找到切片，记录警告但不阻止加载
            if not tiles_found and not map_image_path:
                self.logger.log(f"未找到地图图片或切片，将使用空白地图: {map_id}", "WARNING")
            
            # 如果没有找到mdata.json，尝试查找其他配置文件
            if not map_data:
                # 查找其他可能的配置文件
                for file in os.listdir(map_path):
                    if file.endswith('.json') and file != 'mdata.json':
                        try:
                            config_path = os.path.join(map_path, file)
                            with open(config_path, 'r', encoding='utf-8') as f:
                                map_data = json.load(f)
                            self.logger.log(f"找到地图配置文件: {file}", "INFO")
                            break
                        except:
                            continue
            
            # 如果还是没有数据，创建一个基本的地图数据
            if not map_data:
                map_data = {
                    "name": map_id,
                    "width": 0,
                    "height": 0,
                    "cells": []
                }
                self.logger.log(f"创建基本地图数据: {map_id}", "INFO")
            
            # 创建地图数据对象
            self.current_map_data = MapData(map_id, map_image_path, map_data, tiles)
            self.current_sprite_data = None
            self.logger.log(f"成功加载地图: {map_id}", "INFO")
            return True
            
        except Exception as e:
            self.logger.log(f"加载地图失败: {e}", "ERROR")
            return False

    def _load_scene_sprite(self, subtype: str, sprite_id: str = None) -> bool:
        """加载场景素材"""
        try:
            path = os.path.join(self.base_path, "scene", subtype)
            if not os.path.exists(path):
                return False
            
            # 特殊处理 icon 子类型：sprite_id 使用 “子目录-文件名(无扩展)”
            if subtype == "icon" and sprite_id:
                # 解析合并ID
                if '-' not in sprite_id:
                    self.logger.log(f"icon 类型的ID必须是 子目录-文件名 的形式: {sprite_id}", "ERROR")
                    return False
                icon_subdir, icon_basename = sprite_id.split('-', 1)
                icon_dir = os.path.join(path, icon_subdir)
                if not os.path.isdir(icon_dir):
                    self.logger.log(f"icon 子目录不存在: {icon_subdir}", "ERROR")
                    return False
                # 在该子目录下匹配具体文件名
                image_files = [f for f in os.listdir(icon_dir) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
                target_file = None
                for img_file in image_files:
                    if os.path.splitext(img_file)[0] == icon_basename:
                        target_file = img_file
                        break
                if not target_file:
                    self.logger.log(f"找不到对应的icon图片文件: {icon_basename}", "ERROR")
                    return False
                # 直接加载该图片
                return self._load_simple_images(icon_dir, subtype, icon_basename)

            # 特殊处理 baizhanfeisheng 子类型
            if subtype == "baizhanfeisheng" and sprite_id:
                return self._load_baizhanfeisheng_sprite(path, sprite_id)
            
            # 特殊处理 human 子类型
            if subtype == "human" and sprite_id:
                return self._load_human_sprite(path, sprite_id)
            
            # 特殊处理 weapon 子类型
            if subtype == "weapon" and sprite_id:
                return self._load_weapon_sprite(path, sprite_id)
            
            # 特殊处理 monster 子类型
            if subtype == "monster" and sprite_id:
                return self._load_monster_sprite(path, sprite_id)
            
            # 特殊处理 skill 子类型
            if subtype == "skill" and sprite_id:
                return self._load_skill_sprite(path, sprite_id)
            
            # 检查是否有子文件夹（素材ID）
            has_subfolders = any(os.path.isdir(os.path.join(path, item)) for item in os.listdir(path))
            
            if has_subfolders:
                # 有子文件夹的情况
                if not sprite_id:
                    # 没有指定ID，需要指定ID
                    self.logger.log(f"子类型 {subtype} 需要指定素材ID", "WARNING")
                    return False
                else:
                    # 指定了ID，加载指定素材
                    sprite_path = os.path.join(path, sprite_id)
                    if not os.path.exists(sprite_path):
                        return False
                    
                    # 检查是否有JSON文件
                    json_files = [f for f in os.listdir(sprite_path) if f.endswith('.json')]
                    if json_files:
                        # 有JSON文件，加载动画素材
                        return self._load_animated_sprite(sprite_path, subtype, sprite_id)
                    else:
                        # 没有JSON文件，加载静态图片
                        return self._load_simple_images(sprite_path, subtype, sprite_id)
            else:
                # 没有子文件夹的情况
                if not sprite_id:
                    # 没有指定ID，加载整个子类型的图片列表
                    return self._load_simple_images(path, subtype)
                else:
                    # 指定了ID，说明用户选择了一个具体的图片文件
                    # 在这种情况下，sprite_id实际上是图片文件名（去除扩展名）
                    # 我们需要找到对应的图片文件
                    image_files = [f for f in os.listdir(path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
                    target_file = None
                    for img_file in image_files:
                        if os.path.splitext(img_file)[0] == sprite_id:
                            target_file = img_file
                            break
                    
                    if target_file:
                        # 找到对应的图片文件，加载单张图片
                        return self._load_simple_images(path, subtype, sprite_id)
                    else:
                        self.logger.log(f"找不到对应的图片文件: {sprite_id}", "ERROR")
                        return False
                    
        except Exception as e:
            self.logger.log(f"加载场景素材失败: {e}", "ERROR")
            return False

    def _load_simple_images(self, path: str, subtype: str, sprite_id: str = None) -> bool:
        """加载简单图片素材（没有JSON文件的类型）"""
        try:
            image_files = [f for f in os.listdir(path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
            if not image_files:
                self.logger.log(f"目录中没有图片文件: {path}", "ERROR")
                return False
            
            # 如果指定了sprite_id，说明用户选择了一个具体的图片文件
            if sprite_id:
                # 找到对应的图片文件
                target_file = None
                for img_file in image_files:
                    if os.path.splitext(img_file)[0] == sprite_id:
                        target_file = img_file
                        break
                
                if target_file:
                    # 只加载选中的图片文件
                    image_files = [target_file]
                    self.logger.log(f"加载指定图片: {target_file}", "INFO")
                else:
                    self.logger.log(f"找不到对应的图片文件: {sprite_id}", "ERROR")
                    return False
            
            # 创建简单的精灵数据
            sprite_data = SpriteData(subtype, sprite_id or "simple")
            sprite_data.set_simple_images([os.path.join(path, f) for f in image_files])
            
            self.current_sprite_data = sprite_data
            self.current_map_data = None
            self.logger.log(f"成功加载简单图片: {subtype}, 图片数量: {len(image_files)}", "INFO")
            return True
            
        except Exception as e:
            self.logger.log(f"加载简单图片失败: {e}", "ERROR")
            return False

    def _load_animated_sprite(self, path: str, subtype: str, sprite_id: str) -> bool:
        """加载动画素材（有JSON文件的类型）"""
        try:
            # 查找PNG和JSON文件
            png_files = [f for f in os.listdir(path) if f.endswith('.png')]
            json_files = [f for f in os.listdir(path) if f.endswith('.json')]
            
            if not png_files or not json_files:
                self.logger.log(f"目录中没有PNG或JSON文件: {path}", "ERROR")
                return False
            
            # 加载JSON数据
            json_data = {}
            for json_file in json_files:
                json_path = os.path.join(path, json_file)
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        json_data[json_file] = data
                except Exception as e:
                    self.logger.log(f"加载JSON文件失败 {json_path}: {e}", "WARNING")
            
            # 创建动画帧
            frames = {}
            for png_file in sorted(png_files):
                png_path = os.path.join(path, png_file)
                try:
                    img = Image.open(png_path)
                    
                    # 查找对应的JSON数据
                    json_file = png_file.replace('.png', '.json')
                    if json_file in json_data:
                        data = json_data[json_file]
                        # 解析JSON数据获取帧信息 - 现在返回多个帧
                        frame_list = self._parse_frame_data(data, img)
                        if frame_list:
                            # 为每个帧创建一个唯一的键
                            for i, frame in enumerate(frame_list):
                                frame_key = f"{png_file}_frame_{i}"
                                frames[frame_key] = frame
                    else:
                        # 没有JSON数据，使用默认帧
                        frame = AnimationFrame(img, 100, "down", "stand")
                        frames[png_file] = frame
                        
                except Exception as e:
                    self.logger.log(f"加载PNG文件失败 {png_path}: {e}", "WARNING")
            
            if frames:
                self.current_sprite_data = SpriteData(subtype, sprite_id, frames)
                self.current_map_data = None
                self.logger.log(f"成功加载动画素材: {subtype}/{sprite_id}, 总帧数: {len(frames)}", "INFO")
                return True
            
            return False
            
        except Exception as e:
            self.logger.log(f"加载动画素材失败: {e}", "ERROR")
            return False

    def _parse_frame_data(self, json_data, image: Image.Image) -> List[AnimationFrame]:
        """解析帧数据，返回多个动画帧"""
        try:
            # 根据JSON结构解析帧信息
            # 实际的JSON格式是一个数组，包含帧信息
            if isinstance(json_data, list) and len(json_data) >= 7:
                # 解析复杂的数组格式帧数据
                # 格式: [[x1,x2...], [y1,y2...], [w1,w2...], [h1,h2...], [offset_x1,offset_x2...], [offset_y1,offset_y2...], action_type]
                # 这是你提供的数据格式
                
                # 获取动作类型和持续时间
                action_type = json_data[6] if len(json_data) > 6 else 1
                duration = 100  # 默认持续时间
                
                # 解析各个方向的坐标数据
                x_list = json_data[0] if isinstance(json_data[0], list) else []
                y_list = json_data[1] if isinstance(json_data[1], list) else []
                w_list = json_data[2] if isinstance(json_data[2], list) else []
                h_list = json_data[3] if isinstance(json_data[3], list) else []
                offset_x_list = json_data[4] if isinstance(json_data[4], list) else []
                offset_y_list = json_data[5] if isinstance(json_data[5], list) else []
                
                # 创建多个帧
                frames = []
                if x_list and y_list and w_list and h_list:
                    # 确定帧数（使用最短的列表长度）
                    frame_count = min(len(x_list), len(y_list), len(w_list), len(h_list))
                    
                    for i in range(frame_count):
                        x = x_list[i] if i < len(x_list) else 0
                        y = y_list[i] if i < len(y_list) else 0
                        w = w_list[i] if i < len(w_list) else image.width
                        h = h_list[i] if i < len(h_list) else image.height
                        
                        # 计算偏移
                        offset_x = offset_x_list[i] if offset_x_list and i < len(offset_x_list) else 0
                        offset_y = offset_y_list[i] if offset_y_list and i < len(offset_y_list) else 0
                        
                        # 根据公式计算最终偏移
                        final_offset_x = offset_x + w * 0.5
                        final_offset_y = -offset_y - h * 0.5
                        
                        # 裁剪图片
                        frame_image = image.crop((x, y, x + w, y + h))
                        
                        # 根据动作类型确定动作名称
                        action_map = {1: 'stand', 2: 'walk', 3: 'attack', 4: 'skill'}
                        action = action_map.get(action_type, 'stand')
                        
                        frame = AnimationFrame(frame_image, duration, 'down', action, final_offset_x, final_offset_y)
                        frames.append(frame)
                    
                    return frames
                else:
                    # 如果无法解析方向数据，使用整个图片
                    frame = AnimationFrame(image, duration, 'down', 'stand')
                    return [frame]
                    
            elif isinstance(json_data, list) and len(json_data) >= 6:
                # 解析简单的数组格式帧数据
                # 格式: [x, y, w, h, duration, direction, action, ...]
                x = json_data[0] if len(json_data) > 0 else 0
                y = json_data[1] if len(json_data) > 1 else 0
                w = json_data[2] if len(json_data) > 2 else image.width
                h = json_data[3] if len(json_data) > 3 else image.height
                duration = json_data[4] if len(json_data) > 4 else 100
                direction = json_data[5] if len(json_data) > 5 else 'down'
                action = json_data[6] if len(json_data) > 6 else 'stand'
                
                # 裁剪图片
                frame_image = image.crop((x, y, x + w, y + h))
                
                frame = AnimationFrame(frame_image, duration, direction, action)
                return [frame]
            elif isinstance(json_data, dict) and 'frame' in json_data:
                # 兼容旧的JSON对象格式
                frame_rect = json_data['frame']
                x = frame_rect.get('x', 0)
                y = frame_rect.get('y', 0)
                w = frame_rect.get('w', image.width)
                h = frame_rect.get('h', image.height)
                duration = json_data.get('duration', 100)
                direction = json_data.get('direction', 'down')
                action = json_data.get('action', 'stand')
                
                # 裁剪图片
                frame_image = image.crop((x, y, x + w, y + h))
                
                frame = AnimationFrame(frame_image, duration, direction, action)
                return [frame]
            else:
                # 默认使用整个图片
                frame = AnimationFrame(image, 100, 'down', 'stand')
                return [frame]
                
        except Exception as e:
            self.logger.log(f"解析帧数据失败: {e}", "ERROR")
            # 返回默认帧
            frame = AnimationFrame(image, 100, 'down', 'stand')
            return [frame]

    def _parse_human_filename(self, filename: str) -> Tuple[str, str]:
        """解析human类型的文件名，返回动作和方向"""
        try:
            # 去除扩展名
            name = os.path.splitext(filename)[0]
            
            # 根据文件名前缀确定动作类型
            if name.startswith('00'):
                action = 'stand'
            elif name.startswith('01'):
                action = 'stand'
            elif name.startswith('02'):
                action = 'stand'
            elif name.startswith('03'):
                action = 'stand'
            elif name.startswith('04'):
                action = 'stand'
            elif name.startswith('05'):
                action = 'stand'
            elif name.startswith('06'):
                action = 'stand'
            elif name.startswith('07'):
                action = 'stand'
            elif name.startswith('20'):
                action = 'run'
            elif name.startswith('21'):
                action = 'run'
            elif name.startswith('22'):
                action = 'run'
            elif name.startswith('23'):
                action = 'run'
            elif name.startswith('24'):
                action = 'run'
            elif name.startswith('25'):
                action = 'run'
            elif name.startswith('26'):
                action = 'run'
            elif name.startswith('27'):
                action = 'run'
            elif name.startswith('30'):
                action = 'prepare_attack'
            elif name.startswith('31'):
                action = 'prepare_attack'
            elif name.startswith('32'):
                action = 'prepare_attack'
            elif name.startswith('33'):
                action = 'prepare_attack'
            elif name.startswith('34'):
                action = 'prepare_attack'
            elif name.startswith('35'):
                action = 'prepare_attack'
            elif name.startswith('36'):
                action = 'prepare_attack'
            elif name.startswith('37'):
                action = 'prepare_attack'
            elif name.startswith('40'):
                action = 'attack'
            elif name.startswith('41'):
                action = 'attack'
            elif name.startswith('42'):
                action = 'attack'
            elif name.startswith('43'):
                action = 'attack'
            elif name.startswith('44'):
                action = 'attack'
            elif name.startswith('45'):
                action = 'attack'
            elif name.startswith('46'):
                action = 'attack'
            elif name.startswith('47'):
                action = 'attack'
            elif name.startswith('50'):
                action = 'cast'
            elif name.startswith('51'):
                action = 'cast'
            elif name.startswith('52'):
                action = 'cast'
            elif name.startswith('53'):
                action = 'cast'
            elif name.startswith('54'):
                action = 'cast'
            elif name.startswith('55'):
                action = 'cast'
            elif name.startswith('56'):
                action = 'cast'
            elif name.startswith('57'):
                action = 'cast'
            elif name.startswith('60'):
                action = 'death'
            elif name.startswith('61'):
                action = 'death'
            elif name.startswith('62'):
                action = 'death'
            elif name.startswith('63'):
                action = 'death'
            elif name.startswith('64'):
                action = 'death'
            elif name.startswith('65'):
                action = 'death'
            elif name.startswith('66'):
                action = 'death'
            elif name.startswith('67'):
                action = 'death'
            elif name.startswith('70'):
                action = 'ride_stand'
            elif name.startswith('71'):
                action = 'ride_stand'
            elif name.startswith('72'):
                action = 'ride_stand'
            elif name.startswith('73'):
                action = 'ride_stand'
            elif name.startswith('74'):
                action = 'ride_stand'
            elif name.startswith('75'):
                action = 'ride_stand'
            elif name.startswith('76'):
                action = 'ride_stand'
            elif name.startswith('77'):
                action = 'ride_stand'
            elif name.startswith('80'):
                action = 'ride_run'
            elif name.startswith('81'):
                action = 'ride_run'
            elif name.startswith('82'):
                action = 'ride_run'
            elif name.startswith('83'):
                action = 'ride_run'
            elif name.startswith('84'):
                action = 'ride_run'
            elif name.startswith('85'):
                action = 'ride_run'
            elif name.startswith('86'):
                action = 'ride_run'
            elif name.startswith('87'):
                action = 'ride_run'
            else:
                action = 'stand'
            
            # 根据文件名后缀确定方向 (支持8方向)
            if name.endswith('0'):
                direction = 'up'
            elif name.endswith('1'):
                direction = 'up_right'
            elif name.endswith('2'):
                direction = 'right'
            elif name.endswith('3'):
                direction = 'down_right'
            elif name.endswith('4'):
                direction = 'down'
            elif name.endswith('5'):
                direction = 'down_left'
            elif name.endswith('6'):
                direction = 'left'
            elif name.endswith('7'):
                direction = 'up_left'
            else:
                direction = 'down'
            
            return action, direction
            
        except Exception as e:
            self.logger.log(f"解析human文件名失败 {filename}: {e}", "WARNING")
            return 'stand', 'down'

    def _parse_weapon_filename(self, filename: str) -> Tuple[str, str]:
        """解析weapon类型的文件名，返回动作和方向"""
        try:
            # 去除扩展名
            name = os.path.splitext(filename)[0]
            
            # 根据文件名前缀确定动作类型
            if name.startswith('00') or name.startswith('01') or name.startswith('02') or name.startswith('03') or name.startswith('04'):
                action = 'stand'
            elif name.startswith('20') or name.startswith('21') or name.startswith('22') or name.startswith('23') or name.startswith('24'):
                action = 'run'
            elif name.startswith('30') or name.startswith('31') or name.startswith('32') or name.startswith('33') or name.startswith('34'):
                action = 'prepare_attack'
            elif name.startswith('40') or name.startswith('41') or name.startswith('42') or name.startswith('43') or name.startswith('44'):
                action = 'attack'
            elif name.startswith('50') or name.startswith('51') or name.startswith('52') or name.startswith('53') or name.startswith('54'):
                action = 'cast'
            elif name.startswith('60'):
                action = 'death'
            else:
                action = 'stand'
            
            # 根据文件名后缀确定方向 (支持5方向)
            if name.endswith('0'):
                direction = 'up'
            elif name.endswith('1'):
                direction = 'up_right'
            elif name.endswith('2'):
                direction = 'right'
            elif name.endswith('3'):
                direction = 'down_right'
            elif name.endswith('4'):
                direction = 'down'
            else:
                direction = 'down'
            
            return action, direction
            
        except Exception as e:
            self.logger.log(f"解析weapon文件名失败 {filename}: {e}", "WARNING")
            return 'stand', 'down'

    def _parse_monster_filename(self, filename: str) -> Tuple[str, str]:
        """解析monster类型的文件名，返回动作和方向"""
        try:
            # 去除扩展名
            name = os.path.splitext(filename)[0]
            
            # 根据文件名前缀确定动作类型
            if name.startswith('00') or name.startswith('01') or name.startswith('02') or name.startswith('03') or name.startswith('04'):
                action = 'stand'
            elif name.startswith('10') or name.startswith('11') or name.startswith('12') or name.startswith('13') or name.startswith('14'):
                action = 'run'
            elif name.startswith('40') or name.startswith('41') or name.startswith('42') or name.startswith('43') or name.startswith('44'):
                action = 'attack'
            elif name.startswith('60'):
                action = 'death'
            else:
                action = 'stand'
            
            # 根据文件名后缀确定方向 (支持5方向)
            if name.endswith('0'):
                direction = 'up'
            elif name.endswith('1'):
                direction = 'up_right'
            elif name.endswith('2'):
                direction = 'right'
            elif name.endswith('3'):
                direction = 'down_right'
            elif name.endswith('4'):
                direction = 'down'
            else:
                direction = 'down'
            
            return action, direction
            
        except Exception as e:
            self.logger.log(f"解析monster文件名失败 {filename}: {e}", "WARNING")
            return 'stand', 'down'

    def _generate_mirrored_frames_for_human(self, frames: Dict[str, AnimationFrame], path: str) -> Dict[str, AnimationFrame]:
        """为human类型生成镜像帧，支持8方向"""
        try:
            mirrored_frames = {}
            
            # 方向映射：右方向 -> 左方向
            direction_mapping = {
                'up_right': 'up_left',
                'right': 'left', 
                'down_right': 'down_left'
            }
            
            # 为每个右方向的帧创建对应的左方向镜像帧
            for frame_key, frame in frames.items():
                if frame.direction in direction_mapping:
                    # 创建镜像帧
                    mirrored_direction = direction_mapping[frame.direction]
                    mirrored_image = frame.image.transpose(Image.FLIP_LEFT_RIGHT)
                    
                    # 创建新的帧键名
                    # 从原始文件名推断镜像文件名
                    # 例如：00.png -> 07.png (up -> up_left), 01.png -> 06.png (up_right -> up_left)
                    original_filename = frame_key.split('_frame_')[0]
                    name_without_ext = os.path.splitext(original_filename)[0]
                    
                    # 根据方向映射确定新的文件名后缀
                    if frame.direction == 'up_right':
                        new_suffix = '7'  # up_left
                    elif frame.direction == 'right':
                        new_suffix = '6'  # left
                    elif frame.direction == 'down_right':
                        new_suffix = '5'  # down_left
                    else:
                        continue
                    
                    # 构建新的文件名
                    action_prefix = name_without_ext[:-1]  # 去掉最后一个数字
                    new_filename = f"{action_prefix}{new_suffix}.png"
                    
                    # 创建镜像帧
                    mirrored_frame = AnimationFrame(
                        mirrored_image, 
                        frame.duration, 
                        mirrored_direction, 
                        frame.action,
                        -frame.offset_x,  # 镜像时x偏移需要取反
                        frame.offset_y
                    )
                    
                    # 创建新的帧键
                    frame_index = frame_key.split('_frame_')[-1] if '_frame_' in frame_key else '0'
                    new_frame_key = f"{new_filename}_frame_{frame_index}"
                    
                    mirrored_frames[new_frame_key] = mirrored_frame
                    self.logger.log(f"生成镜像帧: {frame.direction} -> {mirrored_direction}, 文件: {new_filename}", "INFO")
            
            return mirrored_frames
            
        except Exception as e:
            self.logger.log(f"生成镜像帧失败: {e}", "ERROR")
            return {}

    def _generate_mirrored_frames_for_weapon(self, frames: Dict[str, AnimationFrame], path: str) -> Dict[str, AnimationFrame]:
        """为weapon类型生成镜像帧，支持5方向"""
        try:
            mirrored_frames = {}
            
            # 方向映射：右方向 -> 左方向
            direction_mapping = {
                'up_right': 'up_left',
                'right': 'left', 
                'down_right': 'down_left'
            }
            
            # 为每个右方向的帧创建对应的左方向镜像帧
            for frame_key, frame in frames.items():
                if frame.direction in direction_mapping:
                    # 创建镜像帧
                    mirrored_direction = direction_mapping[frame.direction]
                    mirrored_image = frame.image.transpose(Image.FLIP_LEFT_RIGHT)
                    
                    # 创建新的帧键名
                    # 从原始文件名推断镜像文件名
                    # 例如：01.png -> 07.png (up_right -> up_left), 02.png -> 06.png (right -> left), 03.png -> 05.png (down_right -> down_left)
                    original_filename = frame_key.split('_frame_')[0]
                    name_without_ext = os.path.splitext(original_filename)[0]
                    
                    # 根据方向映射确定新的文件名后缀
                    if frame.direction == 'up_right':
                        new_suffix = '7'  # up_left
                    elif frame.direction == 'right':
                        new_suffix = '6'  # left
                    elif frame.direction == 'down_right':
                        new_suffix = '5'  # down_left
                    else:
                        continue
                    
                    # 构建新的文件名
                    action_prefix = name_without_ext[:-1]  # 去掉最后一个数字
                    new_filename = f"{action_prefix}{new_suffix}.png"
                    
                    # 创建镜像帧
                    mirrored_frame = AnimationFrame(
                        mirrored_image, 
                        frame.duration, 
                        mirrored_direction, 
                        frame.action,
                        -frame.offset_x,  # 镜像时x偏移需要取反
                        frame.offset_y
                    )
                    
                    # 创建新的帧键
                    frame_index = frame_key.split('_frame_')[-1] if '_frame_' in frame_key else '0'
                    new_frame_key = f"{new_filename}_frame_{frame_index}"
                    
                    mirrored_frames[new_frame_key] = mirrored_frame
                    self.logger.log(f"生成镜像帧: {frame.direction} -> {mirrored_direction}, 文件: {new_filename}", "INFO")
            
            return mirrored_frames
            
        except Exception as e:
            self.logger.log(f"生成镜像帧失败: {e}", "ERROR")
            return {}

    def _generate_mirrored_frames_for_monster(self, frames: Dict[str, AnimationFrame], path: str) -> Dict[str, AnimationFrame]:
        """为monster类型生成镜像帧，支持5方向"""
        try:
            mirrored_frames = {}
            
            # 方向映射：右方向 -> 左方向
            direction_mapping = {
                'up_right': 'up_left',
                'right': 'left', 
                'down_right': 'down_left'
            }
            
            # 为每个右方向的帧创建对应的左方向镜像帧
            for frame_key, frame in frames.items():
                if frame.direction in direction_mapping:
                    # 创建镜像帧
                    mirrored_direction = direction_mapping[frame.direction]
                    mirrored_image = frame.image.transpose(Image.FLIP_LEFT_RIGHT)
                    
                    # 创建新的帧键名
                    # 从原始文件名推断镜像文件名
                    # 例如：01.png -> 07.png (up_right -> up_left), 02.png -> 06.png (right -> left), 03.png -> 05.png (down_right -> down_left)
                    original_filename = frame_key.split('_frame_')[0]
                    name_without_ext = os.path.splitext(original_filename)[0]
                    
                    # 根据方向映射确定新的文件名后缀
                    if frame.direction == 'up_right':
                        new_suffix = '7'  # up_left
                    elif frame.direction == 'right':
                        new_suffix = '6'  # left
                    elif frame.direction == 'down_right':
                        new_suffix = '5'  # down_left
                    else:
                        continue
                    
                    # 构建新的文件名
                    action_prefix = name_without_ext[:-1]  # 去掉最后一个数字
                    new_filename = f"{action_prefix}{new_suffix}.png"
                    
                    # 创建镜像帧
                    mirrored_frame = AnimationFrame(
                        mirrored_image, 
                        frame.duration, 
                        mirrored_direction, 
                        frame.action,
                        -frame.offset_x,  # 镜像时x偏移需要取反
                        frame.offset_y
                    )
                    
                    # 创建新的帧键
                    frame_index = frame_key.split('_frame_')[-1] if '_frame_' in frame_key else '0'
                    new_frame_key = f"{new_filename}_frame_{frame_index}"
                    
                    mirrored_frames[new_frame_key] = mirrored_frame
                    self.logger.log(f"生成镜像帧: {frame.direction} -> {mirrored_direction}, 文件: {new_filename}", "INFO")
            
            return mirrored_frames
            
        except Exception as e:
            self.logger.log(f"生成镜像帧失败: {e}", "ERROR")
            return {}

    def _generate_mirrored_frames_for_skill(self, frames: Dict[str, AnimationFrame], path: str) -> Dict[str, AnimationFrame]:
        """为skill类型生成镜像帧，支持8方向"""
        try:
            mirrored_frames = {}
            
            # 方向映射：右方向 -> 左方向
            direction_mapping = {
                'up_right': 'up_left',
                'right': 'left', 
                'down_right': 'down_left'
            }
            
            # 为每个右方向的帧创建对应的左方向镜像帧
            for frame_key, frame in frames.items():
                if frame.direction in direction_mapping:
                    # 创建镜像帧
                    mirrored_direction = direction_mapping[frame.direction]
                    mirrored_image = frame.image.transpose(Image.FLIP_LEFT_RIGHT)
                    
                    # 创建新的帧键名
                    # 从原始文件名推断镜像文件名
                    # 例如：01.png -> 07.png (up_right -> up_left), 02.png -> 06.png (right -> left), 03.png -> 05.png (down_right -> down_left)
                    original_filename = frame_key.split('_frame_')[0]
                    name_without_ext = os.path.splitext(original_filename)[0]
                    
                    # 根据方向映射确定新的文件名后缀
                    if frame.direction == 'up_right':
                        new_suffix = '7'  # up_left
                    elif frame.direction == 'right':
                        new_suffix = '6'  # left
                    elif frame.direction == 'down_right':
                        new_suffix = '5'  # down_left'
                    else:
                        continue
                    
                    # 构建新的文件名
                    action_prefix = name_without_ext[:-1]  # 去掉最后一个数字
                    new_filename = f"{action_prefix}{new_suffix}.png"
                    
                    # 创建镜像帧
                    mirrored_frame = AnimationFrame(
                        mirrored_image, 
                        frame.duration, 
                        mirrored_direction, 
                        frame.action,
                        -frame.offset_x,  # 镜像时x偏移需要取反
                        frame.offset_y
                    )
                    
                    # 创建新的帧键
                    frame_index = frame_key.split('_frame_')[-1] if '_frame_' in frame_key else '0'
                    new_frame_key = f"{new_filename}_frame_{frame_index}"
                    
                    mirrored_frames[new_frame_key] = mirrored_frame
                    self.logger.log(f"生成镜像帧: {frame.direction} -> {mirrored_direction}, 文件: {new_filename}", "INFO")
            
            return mirrored_frames
            
        except Exception as e:
            self.logger.log(f"生成镜像帧失败: {e}", "ERROR")
            return {}

    def _load_human_animated_sprite(self, path: str, subtype: str, sprite_id: str) -> bool:
        """特殊处理 human 子类型的动画素材加载"""
        try:
            # 查找PNG和JSON文件
            png_files = [f for f in os.listdir(path) if f.endswith('.png')]
            json_files = [f for f in os.listdir(path) if f.endswith('.json')]
            
            if not png_files or not json_files:
                self.logger.log(f"目录中没有PNG或JSON文件: {path}", "ERROR")
                return False
            
            # 加载JSON数据
            json_data = {}
            for json_file in json_files:
                json_path = os.path.join(path, json_file)
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        json_data[json_file] = data
                except Exception as e:
                    self.logger.log(f"加载JSON文件失败 {json_path}: {e}", "WARNING")
            
            frames = {}
            for png_file in sorted(png_files):
                png_path = os.path.join(path, png_file)
                try:
                    img = Image.open(png_path)
                    action, direction = self._parse_human_filename(png_file)
                    json_file = png_file.replace('.png', '.json')
                    
                    # 特殊处理：如果是死亡动画，不管选择哪个方向都只播放60.png + 60.json
                    if action == 'death':
                        # 检查是否有60.png和60.json文件
                        death_png = "60.png"
                        death_json = "60.json"
                        
                        if death_png in png_files and death_json in json_files:
                            # 如果当前文件是60.png，则正常处理
                            if png_file == death_png:
                                if death_json in json_data:
                                    data = json_data[death_json]
                                    frame_list = self._parse_human_frame_data(data, img, action, direction)
                                    if frame_list:
                                        for i, frame in enumerate(frame_list):
                                            frame_key = f"{png_file}_frame_{i}"
                                            frames[frame_key] = frame
                                else:
                                    frame = AnimationFrame(img, 100, direction, action)
                                    frames[png_file] = frame
                            # 如果不是60.png，则跳过（不加载其他死亡动画文件）
                            else:
                                continue
                        else:
                            # 如果没有60.png和60.json，则正常处理所有死亡动画文件
                            if json_file in json_data:
                                data = json_data[json_file]
                                frame_list = self._parse_human_frame_data(data, img, action, direction)
                                if frame_list:
                                    for i, frame in enumerate(frame_list):
                                        frame_key = f"{png_file}_frame_{i}"
                                        frames[frame_key] = frame
                            else:
                                frame = AnimationFrame(img, 100, direction, action)
                                frames[png_file] = frame
                    else:
                        # 非死亡动画，正常处理
                        if json_file in json_data:
                            data = json_data[json_file]
                            frame_list = self._parse_human_frame_data(data, img, action, direction)
                            if frame_list:
                                for i, frame in enumerate(frame_list):
                                    frame_key = f"{png_file}_frame_{i}"
                                    frames[frame_key] = frame
                        else:
                            frame = AnimationFrame(img, 100, direction, action)
                            frames[png_file] = frame
                        
                except Exception as e:
                    self.logger.log(f"加载PNG文件失败 {png_path}: {e}", "WARNING")
            
            # 生成镜像帧以支持8方向
            mirrored_frames = self._generate_mirrored_frames_for_human(frames, path)
            frames.update(mirrored_frames)
            
            if frames:
                self.current_sprite_data = SpriteData(subtype, sprite_id, frames)
                self.current_map_data = None
                self.logger.log(f"成功加载human动画素材: {subtype}/{sprite_id}, 总帧数: {len(frames)}", "INFO")
                return True
            
            return False
            
        except Exception as e:
            self.logger.log(f"加载human动画素材失败: {e}", "ERROR")
            return False

    def _load_weapon_animated_sprite(self, path: str, subtype: str, sprite_id: str) -> bool:
        """特殊处理 weapon 子类型的动画素材加载"""
        try:
            # 查找PNG和JSON文件
            png_files = [f for f in os.listdir(path) if f.endswith('.png')]
            json_files = [f for f in os.listdir(path) if f.endswith('.json')]
            
            if not png_files or not json_files:
                self.logger.log(f"目录中没有PNG或JSON文件: {path}", "ERROR")
                return False
            
            # 加载JSON数据
            json_data = {}
            for json_file in json_files:
                json_path = os.path.join(path, json_file)
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        json_data[json_file] = data
                except Exception as e:
                    self.logger.log(f"加载JSON文件失败 {json_path}: {e}", "WARNING")
            
            frames = {}
            for png_file in sorted(png_files):
                png_path = os.path.join(path, png_file)
                try:
                    img = Image.open(png_path)
                    action, direction = self._parse_weapon_filename(png_file)
                    json_file = png_file.replace('.png', '.json')
                    
                    # 特殊处理：如果是死亡动画，不管选择哪个方向都只播放60.png + 60.json
                    if action == 'death':
                        # 检查是否有60.png和60.json文件
                        death_png = "60.png"
                        death_json = "60.json"
                        
                        if death_png in png_files and death_json in json_files:
                            # 如果当前文件是60.png，则正常处理
                            if png_file == death_png:
                                if death_json in json_data:
                                    data = json_data[death_json]
                                    frame_list = self._parse_weapon_frame_data(data, img, action, direction)
                                    if frame_list:
                                        for i, frame in enumerate(frame_list):
                                            frame_key = f"{png_file}_frame_{i}"
                                            frames[frame_key] = frame
                                else:
                                    frame = AnimationFrame(img, 100, direction, action)
                                    frames[png_file] = frame
                            # 如果不是60.png，则跳过（不加载其他死亡动画文件）
                            else:
                                continue
                        else:
                            # 如果没有60.png和60.json，则正常处理所有死亡动画文件
                            if json_file in json_data:
                                data = json_data[json_file]
                                frame_list = self._parse_weapon_frame_data(data, img, action, direction)
                                if frame_list:
                                    for i, frame in enumerate(frame_list):
                                        frame_key = f"{png_file}_frame_{i}"
                                        frames[frame_key] = frame
                            else:
                                frame = AnimationFrame(img, 100, direction, action)
                                frames[png_file] = frame
                    else:
                        # 非死亡动画，正常处理
                        if json_file in json_data:
                            data = json_data[json_file]
                            frame_list = self._parse_weapon_frame_data(data, img, action, direction)
                            if frame_list:
                                for i, frame in enumerate(frame_list):
                                    frame_key = f"{png_file}_frame_{i}"
                                    frames[frame_key] = frame
                        else:
                            frame = AnimationFrame(img, 100, direction, action)
                            frames[png_file] = frame
                        
                except Exception as e:
                    self.logger.log(f"加载PNG文件失败 {png_path}: {e}", "WARNING")
            
            # 生成镜像帧以支持5方向
            mirrored_frames = self._generate_mirrored_frames_for_weapon(frames, path)
            frames.update(mirrored_frames)
            
            if frames:
                self.current_sprite_data = SpriteData(subtype, sprite_id, frames)
                self.current_map_data = None
                self.logger.log(f"成功加载weapon动画素材: {subtype}/{sprite_id}, 总帧数: {len(frames)}", "INFO")
                return True
            
            return False
            
        except Exception as e:
            self.logger.log(f"加载weapon动画素材失败: {e}", "ERROR")
            return False

    def _load_monster_animated_sprite(self, path: str, subtype: str, sprite_id: str) -> bool:
        """特殊处理 monster 子类型的动画素材加载"""
        try:
            # 查找PNG和JSON文件
            png_files = [f for f in os.listdir(path) if f.endswith('.png')]
            json_files = [f for f in os.listdir(path) if f.endswith('.json')]
            
            if not png_files or not json_files:
                self.logger.log(f"目录中没有PNG或JSON文件: {path}", "ERROR")
                return False
            
            # 加载JSON数据
            json_data = {}
            for json_file in json_files:
                json_path = os.path.join(path, json_file)
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        json_data[json_file] = data
                except Exception as e:
                    self.logger.log(f"加载JSON文件失败 {json_path}: {e}", "WARNING")
            
            frames = {}
            for png_file in sorted(png_files):
                png_path = os.path.join(path, png_file)
                try:
                    img = Image.open(png_path)
                    action, direction = self._parse_monster_filename(png_file)
                    json_file = png_file.replace('.png', '.json')
                    
                    # 特殊处理：如果是死亡动画，不管选择哪个方向都只播放60.png + 60.json
                    if action == 'death':
                        # 检查是否有60.png和60.json文件
                        death_png = "60.png"
                        death_json = "60.json"
                        
                        if death_png in png_files and death_json in json_files:
                            # 如果当前文件是60.png，则正常处理
                            if png_file == death_png:
                                if death_json in json_data:
                                    data = json_data[death_json]
                                    frame_list = self._parse_monster_frame_data(data, img, action, direction)
                                    if frame_list:
                                        for i, frame in enumerate(frame_list):
                                            frame_key = f"{png_file}_frame_{i}"
                                            frames[frame_key] = frame
                                else:
                                    frame = AnimationFrame(img, 100, direction, action)
                                    frames[png_file] = frame
                            # 如果不是60.png，则跳过（不加载其他死亡动画文件）
                            else:
                                continue
                        else:
                            # 如果没有60.png和60.json，则正常处理所有死亡动画文件
                            if json_file in json_data:
                                data = json_data[json_file]
                                frame_list = self._parse_monster_frame_data(data, img, action, direction)
                                if frame_list:
                                    for i, frame in enumerate(frame_list):
                                        frame_key = f"{png_file}_frame_{i}"
                                        frames[frame_key] = frame
                            else:
                                frame = AnimationFrame(img, 100, direction, action)
                                frames[png_file] = frame
                    else:
                        # 非死亡动画，正常处理
                        if json_file in json_data:
                            data = json_data[json_file]
                            frame_list = self._parse_monster_frame_data(data, img, action, direction)
                            if frame_list:
                                for i, frame in enumerate(frame_list):
                                    frame_key = f"{png_file}_frame_{i}"
                                    frames[frame_key] = frame
                        else:
                            frame = AnimationFrame(img, 100, direction, action)
                            frames[png_file] = frame
                        
                except Exception as e:
                    self.logger.log(f"加载PNG文件失败 {png_path}: {e}", "WARNING")
            
            # 生成镜像帧以支持5方向
            mirrored_frames = self._generate_mirrored_frames_for_monster(frames, path)
            frames.update(mirrored_frames)
            
            if frames:
                self.current_sprite_data = SpriteData(subtype, sprite_id, frames)
                self.current_map_data = None
                self.logger.log(f"成功加载monster动画素材: {subtype}/{sprite_id}, 总帧数: {len(frames)}", "INFO")
                return True
            
            return False
            
        except Exception as e:
            self.logger.log(f"加载monster动画素材失败: {e}", "ERROR")
            return False

    def _parse_human_frame_data(self, json_data, image: Image.Image, action: str, direction: str) -> List[AnimationFrame]:
        """解析human类型的帧数据"""
        try:
            # 使用通用的帧数据解析方法
            frames = self._parse_frame_data(json_data, image)
            
            # 更新帧的动作和方向信息
            for frame in frames:
                frame.action = action
                frame.direction = direction
            
            return frames
            
        except Exception as e:
            self.logger.log(f"解析human帧数据失败: {e}", "ERROR")
            # 返回默认帧
            frame = AnimationFrame(image, 100, direction, action)
            return [frame]

    def _parse_weapon_frame_data(self, json_data, image: Image.Image, action: str, direction: str) -> List[AnimationFrame]:
        """解析weapon类型的帧数据"""
        try:
            # 使用通用的帧数据解析方法
            frames = self._parse_frame_data(json_data, image)
            
            # 更新帧的动作和方向信息
            for frame in frames:
                frame.action = action
                frame.direction = direction
            
            return frames
            
        except Exception as e:
            self.logger.log(f"解析weapon帧数据失败: {e}", "ERROR")
            # 返回默认帧
            frame = AnimationFrame(image, 100, direction, action)
            return [frame]

    def _parse_monster_frame_data(self, json_data, image: Image.Image, action: str, direction: str) -> List[AnimationFrame]:
        """解析monster类型的帧数据"""
        try:
            # 使用通用的帧数据解析方法
            frames = self._parse_frame_data(json_data, image)
            
            # 更新帧的动作和方向信息
            for frame in frames:
                frame.action = action
                frame.direction = direction
            
            return frames
            
        except Exception as e:
            self.logger.log(f"解析monster帧数据失败: {e}", "ERROR")
            # 返回默认帧
            frame = AnimationFrame(image, 100, direction, action)
            return [frame]

    def _load_skill_animated_sprite(self, path: str, subtype: str, sprite_id: str) -> bool:
        """特殊处理 skill 子类型的动画素材加载"""
        try:
            # 查找PNG和JSON文件
            png_files = [f for f in os.listdir(path) if f.endswith('.png')]
            json_files = [f for f in os.listdir(path) if f.endswith('.json')]
            
            if not png_files or not json_files:
                self.logger.log(f"目录中没有PNG或JSON文件: {path}", "ERROR")
                return False
            
            # 加载JSON数据
            json_data = {}
            for json_file in json_files:
                json_path = os.path.join(path, json_file)
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        json_data[json_file] = data
                except Exception as e:
                    self.logger.log(f"加载JSON文件失败 {json_path}: {e}", "WARNING")
            
            frames = {}
            for png_file in sorted(png_files):
                png_path = os.path.join(path, png_file)
                try:
                    img = Image.open(png_path)
                    action, direction = self._parse_skill_filename(png_file)
                    json_file = png_file.replace('.png', '.json')
                    
                    # 特殊处理：如果是死亡动画，不管选择哪个方向都只播放60.png + 60.json
                    if action == 'death':
                        # 检查是否有60.png和60.json文件
                        death_png = "60.png"
                        death_json = "60.json"
                        
                        if death_png in png_files and death_json in json_files:
                            # 如果当前文件是60.png，则正常处理
                            if png_file == death_png:
                                if death_json in json_data:
                                    data = json_data[death_json]
                                    frame_list = self._parse_skill_frame_data(data, img, action, direction)
                                    if frame_list:
                                        for i, frame in enumerate(frame_list):
                                            frame_key = f"{png_file}_frame_{i}"
                                            frames[frame_key] = frame
                                else:
                                    frame = AnimationFrame(img, 100, direction, action)
                                    frames[png_file] = frame
                            # 如果不是60.png，则跳过（不加载其他死亡动画文件）
                            else:
                                continue
                        else:
                            # 如果没有60.png和60.json，则正常处理所有死亡动画文件
                            if json_file in json_data:
                                data = json_data[json_file]
                                frame_list = self._parse_skill_frame_data(data, img, action, direction)
                                if frame_list:
                                    for i, frame in enumerate(frame_list):
                                        frame_key = f"{png_file}_frame_{i}"
                                        frames[frame_key] = frame
                            else:
                                frame = AnimationFrame(img, 100, direction, action)
                                frames[png_file] = frame
                    else:
                        # 非死亡动画，正常处理
                        if json_file in json_data:
                            data = json_data[json_file]
                            frame_list = self._parse_skill_frame_data(data, img, action, direction)
                            if frame_list:
                                for i, frame in enumerate(frame_list):
                                    frame_key = f"{png_file}_frame_{i}"
                                    frames[frame_key] = frame
                        else:
                            frame = AnimationFrame(img, 100, direction, action)
                            frames[png_file] = frame
                        
                except Exception as e:
                    self.logger.log(f"加载PNG文件失败 {png_path}: {e}", "WARNING")
            
            # 生成镜像帧以支持8方向
            mirrored_frames = self._generate_mirrored_frames_for_skill(frames, path)
            frames.update(mirrored_frames)
            
            if frames:
                self.current_sprite_data = SpriteData(subtype, sprite_id, frames)
                self.current_map_data = None
                self.logger.log(f"成功加载skill动画素材: {subtype}/{sprite_id}, 总帧数: {len(frames)}", "INFO")
                return True
            
            return False
            
        except Exception as e:
            self.logger.log(f"加载skill动画素材失败: {e}", "ERROR")
            return False

    def _parse_skill_filename(self, filename: str) -> Tuple[str, str]:
        """解析skill类型的文件名，返回动作和方向"""
        try:
            # 去除扩展名
            name = os.path.splitext(filename)[0]
            
            # 根据文件名前缀确定动作类型
            if name.startswith('00'):
                action = 'stand'
            elif name.startswith('01'):
                action = 'stand'
            elif name.startswith('02'):
                action = 'stand'
            elif name.startswith('03'):
                action = 'stand'
            elif name.startswith('04'):
                action = 'stand'
            elif name.startswith('05'):
                action = 'stand'
            elif name.startswith('06'):
                action = 'stand'
            elif name.startswith('07'):
                action = 'stand'
            elif name.startswith('20'):
                action = 'run'
            elif name.startswith('21'):
                action = 'run'
            elif name.startswith('22'):
                action = 'run'
            elif name.startswith('23'):
                action = 'run'
            elif name.startswith('24'):
                action = 'run'
            elif name.startswith('25'):
                action = 'run'
            elif name.startswith('26'):
                action = 'run'
            elif name.startswith('27'):
                action = 'run'
            elif name.startswith('30'):
                action = 'prepare_attack'
            elif name.startswith('31'):
                action = 'prepare_attack'
            elif name.startswith('32'):
                action = 'prepare_attack'
            elif name.startswith('33'):
                action = 'prepare_attack'
            elif name.startswith('34'):
                action = 'prepare_attack'
            elif name.startswith('35'):
                action = 'prepare_attack'
            elif name.startswith('36'):
                action = 'prepare_attack'
            elif name.startswith('37'):
                action = 'prepare_attack'
            elif name.startswith('40'):
                action = 'attack'
            elif name.startswith('41'):
                action = 'attack'
            elif name.startswith('42'):
                action = 'attack'
            elif name.startswith('43'):
                action = 'attack'
            elif name.startswith('44'):
                action = 'attack'
            elif name.startswith('45'):
                action = 'attack'
            elif name.startswith('46'):
                action = 'attack'
            elif name.startswith('47'):
                action = 'attack'
            elif name.startswith('50'):
                action = 'cast'
            elif name.startswith('51'):
                action = 'cast'
            elif name.startswith('52'):
                action = 'cast'
            elif name.startswith('53'):
                action = 'cast'
            elif name.startswith('54'):
                action = 'cast'
            elif name.startswith('55'):
                action = 'cast'
            elif name.startswith('56'):
                action = 'cast'
            elif name.startswith('57'):
                action = 'cast'
            elif name.startswith('60'):
                action = 'death'
            elif name.startswith('61'):
                action = 'death'
            elif name.startswith('62'):
                action = 'death'
            elif name.startswith('63'):
                action = 'death'
            elif name.startswith('64'):
                action = 'death'
            elif name.startswith('65'):
                action = 'death'
            elif name.startswith('66'):
                action = 'death'
            elif name.startswith('67'):
                action = 'death'
            elif name.startswith('70'):
                action = 'ride_stand'
            elif name.startswith('71'):
                action = 'ride_stand'
            elif name.startswith('72'):
                action = 'ride_stand'
            elif name.startswith('73'):
                action = 'ride_stand'
            elif name.startswith('74'):
                action = 'ride_stand'
            elif name.startswith('75'):
                action = 'ride_stand'
            elif name.startswith('76'):
                action = 'ride_stand'
            elif name.startswith('77'):
                action = 'ride_stand'
            elif name.startswith('80'):
                action = 'ride_run'
            elif name.startswith('81'):
                action = 'ride_run'
            elif name.startswith('82'):
                action = 'ride_run'
            elif name.startswith('83'):
                action = 'ride_run'
            elif name.startswith('84'):
                action = 'ride_run'
            elif name.startswith('85'):
                action = 'ride_run'
            elif name.startswith('86'):
                action = 'ride_run'
            elif name.startswith('87'):
                action = 'ride_run'
            else:
                action = 'stand'
            
            # 根据文件名后缀确定方向 (支持8方向)
            if name.endswith('0'):
                direction = 'up'
            elif name.endswith('1'):
                direction = 'up_right'
            elif name.endswith('2'):
                direction = 'right'
            elif name.endswith('3'):
                direction = 'down_right'
            elif name.endswith('4'):
                direction = 'down'
            elif name.endswith('5'):
                direction = 'down_left'
            elif name.endswith('6'):
                direction = 'left'
            elif name.endswith('7'):
                direction = 'up_left'
            else:
                direction = 'down'
            
            return action, direction
            
        except Exception as e:
            self.logger.log(f"解析skill文件名失败 {filename}: {e}", "WARNING")
            return 'stand', 'down'

    def _parse_skill_frame_data(self, json_data, image: Image.Image, action: str, direction: str) -> List[AnimationFrame]:
        """解析skill类型的帧数据"""
        try:
            # 使用通用的帧数据解析方法
            frames = self._parse_frame_data(json_data, image)
            
            # 更新帧的动作和方向信息
            for frame in frames:
                frame.action = action
                frame.direction = direction
            
            return frames
            
        except Exception as e:
            self.logger.log(f"解析skill帧数据失败: {e}", "ERROR")
            # 返回默认帧
            frame = AnimationFrame(image, 100, direction, action)
            return [frame]

    def get_current_sprite_data(self) -> Optional[SpriteData]:
        """获取当前精灵数据"""
        return self.current_sprite_data

    def get_current_map_data(self) -> Optional[MapData]:
        """获取当前地图数据"""
        return self.current_map_data

    def clear_cache(self):
        """清理缓存"""
        if self.current_sprite_data:
            self.current_sprite_data.clear_cache()
        if self.current_map_data:
            self.current_map_data.clear_cache()
        self.logger.log("缓存清理完成", "INFO")

    def load_h5_map_data(self, map_id: str) -> Optional[MapData]:
        """加载H5地图数据"""
        print(f"SpriteManager: 开始加载H5地图数据，地图ID: {map_id}")
        self.logger.log(f"开始加载H5地图: {map_id}", "INFO")
        try:
            print(f"SpriteManager: 进入try块，开始构建路径")
            # 构建路径
            h5_map_path = os.path.join(self.base_path, "H5v", "map")
            battlemap_path = os.path.join(h5_map_path, "battlemap")
            data_path = os.path.join(h5_map_path, "data")
            
            print(f"SpriteManager: H5地图基础路径: {h5_map_path}")
            print(f"SpriteManager: 战斗地图路径: {battlemap_path}")
            print(f"SpriteManager: 数据路径: {data_path}")
            self.logger.log(f"H5地图基础路径: {h5_map_path}", "DEBUG")
            self.logger.log(f"战斗地图路径: {battlemap_path}", "DEBUG")
            self.logger.log(f"数据路径: {data_path}", "DEBUG")
            
            print(f"SpriteManager: 开始检查路径是否存在")
            # 检查路径是否存在
            if not os.path.exists(battlemap_path):
                print(f"SpriteManager: 战斗地图路径不存在: {battlemap_path}")
                self.logger.log(f"战斗地图路径不存在: {battlemap_path}", "ERROR")
                return None
            if not os.path.exists(data_path):
                print(f"SpriteManager: 数据路径不存在: {data_path}")
                self.logger.log(f"数据路径不存在: {data_path}", "ERROR")
                return None
            
            print(f"SpriteManager: H5地图路径检查通过")
            self.logger.log("H5地图路径检查通过", "INFO")
            
            # 读取XML配置文件
            xml_path = os.path.join(data_path, "map", "scene", f"{map_id}.xml")
            print(f"SpriteManager: XML配置文件路径: {xml_path}")
            self.logger.log(f"XML配置文件路径: {xml_path}", "DEBUG")
            
            if not os.path.exists(xml_path):
                print(f"SpriteManager: XML配置文件不存在: {xml_path}")
                self.logger.log(f"XML配置文件不存在: {xml_path}", "ERROR")
                return None
            
            print(f"SpriteManager: 开始解析XML配置文件")
            self.logger.log("开始解析XML配置文件", "INFO")
            
            # 解析XML文件
            print(f"SpriteManager: 导入XML解析模块")
            import xml.etree.ElementTree as ET
            print(f"SpriteManager: 开始解析XML文件: {xml_path}")
            tree = ET.parse(xml_path)
            root = tree.getroot()
            print(f"SpriteManager: XML解析成功，根节点: {root.tag}")
            
            self.logger.log(f"XML根节点: {root.tag}", "DEBUG")
            
            # 提取地图信息
            map_info = {}
            for child in root:
                self.logger.log(f"解析XML节点: {child.tag} = {child.text}", "DEBUG")
                if child.tag == 'id':
                    map_info['id'] = child.text
                elif child.tag == 'res_id':
                    map_info['res_id'] = child.text
                elif child.tag == 'res_x':
                    map_info['res_x'] = int(child.text)
                elif child.tag == 'res_y':
                    map_info['res_y'] = int(child.text)
                elif child.tag == 'pixel_width':
                    map_info['pixel_width'] = int(child.text)
                elif child.tag == 'pixel_height':
                    map_info['pixel_height'] = int(child.text)
                elif child.tag == 'logic_width':
                    map_info['logic_width'] = int(child.text)
                elif child.tag == 'logic_height':
                    map_info['logic_height'] = int(child.text)
                elif child.tag == 'mask':
                    map_info['mask'] = child.text
            
            self.logger.log(f"XML解析完成，地图信息: {map_info}", "INFO")
            print(f"SpriteManager: XML解析完成，地图信息: {map_info}")
            
            # 获取瓦片图片
            tiles_path = os.path.join(battlemap_path, "map", map_id)
            print(f"SpriteManager: 瓦片图片目录: {tiles_path}")
            self.logger.log(f"瓦片图片目录: {tiles_path}", "DEBUG")
            
            if not os.path.exists(tiles_path):
                print(f"SpriteManager: 瓦片图片目录不存在: {tiles_path}")
                self.logger.log(f"瓦片图片目录不存在: {tiles_path}", "ERROR")
                return None
            
            print(f"SpriteManager: 开始收集瓦片图片")
            self.logger.log("开始收集瓦片图片", "INFO")
            
            # 收集所有瓦片图片
            tiles = []
            all_files = os.listdir(tiles_path)
            print(f"SpriteManager: 瓦片目录中的文件数量: {len(all_files)}")
            self.logger.log(f"瓦片目录中的文件: {all_files}", "DEBUG")
            
            for filename in all_files:
                if filename.startswith('m') and filename.endswith('.jpg'):
                    # 解析文件名 m{row}_{col}.jpg
                    try:
                        name_part = filename[1:-4]  # 去掉'm'和'.jpg'
                        if '_' in name_part:
                            row_str, col_str = name_part.split('_', 1)
                            row = int(row_str)
                            col = int(col_str)
                            file_path = os.path.join(tiles_path, filename)
                            tiles.append((row, col, file_path))
                            self.logger.log(f"找到瓦片: {filename} -> 行{row}, 列{col}", "DEBUG")
                    except ValueError as e:
                        self.logger.log(f"解析瓦片文件名失败: {filename}, 错误: {e}", "WARN")
                        continue
            
            self.logger.log(f"共找到 {len(tiles)} 个瓦片图片", "INFO")
            print(f"SpriteManager: 共找到 {len(tiles)} 个瓦片图片")
            
            if not tiles:
                print(f"SpriteManager: 未找到瓦片图片: {tiles_path}")
                self.logger.log(f"未找到瓦片图片: {tiles_path}", "ERROR")
                return None
            
            # 解析阻挡数据
            print(f"SpriteManager: 开始解析遮罩数据")
            self.logger.log("开始解析遮罩数据", "INFO")
            cells = []
            if 'mask' in map_info:
                mask_str = map_info['mask']
                self.logger.log(f"遮罩字符串长度: {len(mask_str)}", "DEBUG")
                self.logger.log(f"遮罩字符串前100字符: {mask_str[:100]}", "DEBUG")
                
                for i, char in enumerate(mask_str):
                    if char == '1':
                        cells.append(0)  # 可通行
                    elif char == 'b':
                        cells.append(1)  # 阻挡
                    elif char == '0':
                        cells.append(2)  # 特殊区域
                    else:
                        cells.append(0)  # 默认可通行
                
                self.logger.log(f"遮罩数据解析完成，共 {len(cells)} 个单元格", "INFO")
                print(f"SpriteManager: 遮罩数据解析完成，共 {len(cells)} 个单元格")
                # 统计各种类型的数量
                walkable_count = cells.count(0)
                blocked_count = cells.count(1)
                special_count = cells.count(2)
                self.logger.log(f"遮罩统计 - 可通行: {walkable_count}, 阻挡: {blocked_count}, 特殊: {special_count}", "INFO")
                print(f"SpriteManager: 遮罩统计 - 可通行: {walkable_count}, 阻挡: {blocked_count}, 特殊: {special_count}")
            else:
                print(f"SpriteManager: 未找到遮罩数据")
                self.logger.log("未找到遮罩数据", "WARN")
            
            # 创建地图配置
            print(f"SpriteManager: 创建地图配置")
            self.logger.log("创建地图配置", "INFO")
            config = {
                'width': map_info.get('logic_width', 0),
                'height': map_info.get('logic_height', 0),
                'pixel_width': map_info.get('pixel_width', 0),
                'pixel_height': map_info.get('pixel_height', 0),
                'cells': cells
            }
            
            self.logger.log(f"地图配置: 逻辑尺寸 {config['width']}x{config['height']}, 像素尺寸 {config['pixel_width']}x{config['pixel_height']}", "INFO")
            print(f"SpriteManager: 地图配置: 逻辑尺寸 {config['width']}x{config['height']}, 像素尺寸 {config['pixel_width']}x{config['pixel_height']}")
            
            # 创建MapData对象
            print(f"SpriteManager: 开始创建MapData对象")
            self.logger.log("创建MapData对象", "INFO")
            try:
                map_data = MapData(
                    name=f"H5地图_{map_id}",
                    image_path="",  # 使用瓦片拼接
                    config=config,
                    tiles=tiles,
                    config_manager=self.config_manager
                )
                print(f"SpriteManager: MapData对象创建成功")
            except Exception as e:
                print(f"SpriteManager: MapData对象创建失败: {e}")
                self.logger.log(f"MapData对象创建失败: {e}", "ERROR")
                raise
            
            print(f"SpriteManager: H5地图加载完成，准备返回结果")
            self.logger.log(f"成功加载H5地图: {map_id}, 瓦片数量: {len(tiles)}, 逻辑尺寸: {config['width']}x{config['height']}", "INFO")
            self.logger.log("H5地图加载流程完成", "INFO")
            return map_data
            
        except Exception as e:
            print(f"SpriteManager: 加载H5地图异常 {map_id}: {e}")
            print(f"SpriteManager: 异常类型: {type(e).__name__}")
            import traceback
            print(f"SpriteManager: 异常堆栈: {traceback.format_exc()}")
            self.logger.log(f"加载H5地图失败 {map_id}: {e}", "ERROR")
            return None
