# src/utils/config_manager.py - 配置管理系统
import json
import os
from typing import Dict, Any, Optional
from pathlib import Path


class ConfigManager:
    """配置管理系统"""
    
    def __init__(self, config_file: str = "config.json"):
        self.config_file = config_file
        self.default_config = {
            # 导出设置
            "export": {
                "directory": "导出",
                "map_subdirectory": "地图",
                "sprite_subdirectory": "素材",
                "auto_create_directories": True
            },
            # 默认加载设置
            "defaults": {
                "sprite_type": "human",
                "sprite_directory": "",
                "auto_load_last_directory": True,
                "last_directory": ""
            },
            # 图像处理设置
            "image": {
                "max_zoom": 5.0,
                "min_zoom": 0.1,
                "default_zoom": 1.0,
                "quality": 95,
                "format": "PNG"
            },
            # 性能设置
            "performance": {
                "max_cache_size": 100 * 1024 * 1024,  # 100MB
                "cache_cleanup_interval": 300,  # 5分钟
                "max_image_size": 4096,
                "enable_progressive_loading": True
            },
            # UI设置
            "ui": {
                "window_width": 1400,
                "window_height": 900,
                "theme": "default",
                "auto_save_layout": True,
                "show_grid": False,
                "show_reference_lines": True
            },
            # 地图设置
            "map": {
                "default_scale": 1.0,
                "minimap_size": 256,
                "show_minimap": True,
                "auto_fit_to_canvas": True,
                "marker_colors": {
                    "walkable": "#00FF00",      # 可通行 - 绿色
                    "blocked": "#FF0000",       # 不可通行 - 红色
                    "masked": "#0000FF"         # 遮罩 - 蓝色
                },
                "marker_alpha": 0.3             # 标记透明度
            },
            # 插件设置
            "plugins": {
                "enabled_plugins": [],
                "plugin_directory": "plugins",
                "auto_load_plugins": True
            }
        }
        self.config = self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded_config = json.load(f)
                    # 合并默认配置和加载的配置
                    return self._merge_config(self.default_config, loaded_config)
            else:
                # 如果配置文件不存在，创建默认配置
                self.save_config(self.default_config)
                return self.default_config
        except Exception as e:
            print(f"加载配置文件失败: {e}")
            return self.default_config
    
    def save_config(self, config: Optional[Dict[str, Any]] = None) -> bool:
        """保存配置文件"""
        try:
            if config is None:
                config = self.config
            
            # 确保配置目录存在
            config_dir = os.path.dirname(self.config_file)
            if config_dir and not os.path.exists(config_dir):
                os.makedirs(config_dir)
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"保存配置文件失败: {e}")
            return False
    
    def _merge_config(self, default: Dict[str, Any], loaded: Dict[str, Any]) -> Dict[str, Any]:
        """合并配置，确保所有默认值都存在"""
        result = default.copy()
        
        def merge_dict(target: Dict[str, Any], source: Dict[str, Any]):
            for key, value in source.items():
                if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                    merge_dict(target[key], value)
                else:
                    target[key] = value
        
        merge_dict(result, loaded)
        return result
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取配置值"""
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        
        return value
    
    def set(self, key: str, value: Any) -> bool:
        """设置配置值"""
        try:
            keys = key.split('.')
            current = self.config
            
            # 导航到父级字典
            for k in keys[:-1]:
                if k not in current:
                    current[k] = {}
                current = current[k]
            
            # 设置值
            current[keys[-1]] = value
            
            # 保存配置
            return self.save_config()
        except Exception as e:
            print(f"设置配置失败: {e}")
            return False
    
    def remove(self, key: str) -> bool:
        """删除配置项"""
        try:
            keys = key.split('.')
            current = self.config
            
            # 导航到父级字典
            for k in keys[:-1]:
                if k not in current:
                    return True  # 如果路径不存在，认为删除成功
                current = current[k]
            
            # 删除值
            if keys[-1] in current:
                del current[keys[-1]]
                return self.save_config()
            
            return True
        except Exception as e:
            print(f"删除配置失败: {e}")
            return False
    
    def get_export_directory(self) -> str:
        """获取导出目录"""
        return self.get('export.directory', '导出')
    
    def get_map_export_directory(self) -> str:
        """获取地图导出目录"""
        export_dir = self.get_export_directory()
        map_subdir = self.get('export.map_subdirectory', '地图')
        return os.path.join(export_dir, map_subdir)
    
    def get_sprite_export_directory(self) -> str:
        """获取素材导出目录"""
        export_dir = self.get_export_directory()
        sprite_subdir = self.get('export.sprite_subdirectory', '素材')
        return os.path.join(export_dir, sprite_subdir)
    
    def get_max_zoom(self) -> float:
        """获取最大缩放比例"""
        return self.get('image.max_zoom', 5.0)
    
    def get_min_zoom(self) -> float:
        """获取最小缩放比例"""
        return self.get('image.min_zoom', 0.1)
    
    def get_default_zoom(self) -> float:
        """获取默认缩放比例"""
        return self.get('image.default_zoom', 1.0)
    
    def get_max_cache_size(self) -> int:
        """获取最大缓存大小"""
        return self.get('performance.max_cache_size', 100 * 1024 * 1024)
    
    def get_window_size(self) -> tuple:
        """获取窗口大小"""
        width = self.get('ui.window_width', 1400)
        height = self.get('ui.window_height', 900)
        return (width, height)
    
    def set_window_size(self, width: int, height: int) -> bool:
        """设置窗口大小"""
        return self.set('ui.window_width', width) and self.set('ui.window_height', height)
    
    def get_last_directory(self) -> str:
        """获取上次使用的目录"""
        return self.get('defaults.last_directory', '')
    
    def set_last_directory(self, directory: str) -> bool:
        """设置上次使用的目录"""
        return self.set('defaults.last_directory', directory)
    
    def get_default_sprite_type(self) -> str:
        """获取默认素材类型"""
        return self.get('defaults.sprite_type', 'human')
    
    def set_default_sprite_type(self, sprite_type: str) -> bool:
        """设置默认素材类型"""
        return self.set('defaults.sprite_type', sprite_type)
    
    def get_enabled_plugins(self) -> list:
        """获取启用的插件列表"""
        return self.get('plugins.enabled_plugins', [])
    
    def set_enabled_plugins(self, plugins: list) -> bool:
        """设置启用的插件列表"""
        return self.set('plugins.enabled_plugins', plugins)
    
    def add_enabled_plugin(self, plugin_name: str) -> bool:
        """添加启用的插件"""
        plugins = self.get_enabled_plugins()
        if plugin_name not in plugins:
            plugins.append(plugin_name)
            return self.set_enabled_plugins(plugins)
        return True
    
    def remove_enabled_plugin(self, plugin_name: str) -> bool:
        """移除启用的插件"""
        plugins = self.get_enabled_plugins()
        if plugin_name in plugins:
            plugins.remove(plugin_name)
            return self.set_enabled_plugins(plugins)
        return True
    
    def get_map_marker_colors(self) -> dict:
        """获取地图标记颜色"""
        return self.get("map.marker_colors", {
            "walkable": "#00FF00",
            "blocked": "#FF0000", 
            "masked": "#0000FF"
        })
    
    def set_map_marker_colors(self, colors: dict) -> bool:
        """设置地图标记颜色"""
        return self.set("map.marker_colors", colors)
    
    def get_map_marker_alpha(self) -> float:
        """获取地图标记透明度"""
        return self.get("map.marker_alpha", 0.3)
    
    def set_map_marker_alpha(self, alpha: float) -> bool:
        """设置地图标记透明度"""
        return self.set("map.marker_alpha", alpha) 