# src/utils/state_manager.py - 状态管理系统
from typing import Dict, Any, Optional, Callable, List
from dataclasses import dataclass, field
from datetime import datetime
import threading
import json
import os


@dataclass
class AppState:
    """应用程序状态数据类"""
    # 当前素材类型
    current_sprite_type: str = "human"
    
    # 当前素材ID
    current_sprite_id: str = ""
    
    # 当前动作
    current_action: str = "stand"
    
    # 当前方向
    current_direction: int = 0
    
    # 动画播放状态
    animation_playing: bool = False
    
    # 动画速度
    animation_speed: int = 100
    
    # 偏移量
    offset_x: int = 0
    offset_y: int = 0
    
    # 缩放比例
    zoom_level: float = 1.0
    
    # 地图显示选项
    show_walkable: bool = True
    show_blocked: bool = True
    show_masked: bool = True
    
    # 最后使用的目录
    last_directory: str = ""
    
    # 窗口大小
    window_width: int = 1400
    window_height: int = 900
    
    # 性能统计
    memory_usage_mb: float = 0.0
    cpu_percent: float = 0.0
    cache_size_mb: float = 0.0
    
    # 插件状态
    enabled_plugins: List[str] = field(default_factory=list)
    
    # 时间戳
    last_updated: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'current_sprite_type': self.current_sprite_type,
            'current_sprite_id': self.current_sprite_id,
            'current_action': self.current_action,
            'current_direction': self.current_direction,
            'animation_playing': self.animation_playing,
            'animation_speed': self.animation_speed,
            'offset_x': self.offset_x,
            'offset_y': self.offset_y,
            'zoom_level': self.zoom_level,
            'show_walkable': self.show_walkable,
            'show_blocked': self.show_blocked,
            'show_masked': self.show_masked,
            'last_directory': self.last_directory,
            'window_width': self.window_width,
            'window_height': self.window_height,
            'memory_usage_mb': self.memory_usage_mb,
            'cpu_percent': self.cpu_percent,
            'cache_size_mb': self.cache_size_mb,
            'enabled_plugins': self.enabled_plugins,
            'last_updated': self.last_updated.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AppState':
        """从字典创建状态"""
        state = cls()
        for key, value in data.items():
            if hasattr(state, key):
                if key == 'last_updated':
                    state.last_updated = datetime.fromisoformat(value)
                else:
                    setattr(state, key, value)
        return state


class StateManager:
    """状态管理器"""
    
    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.state = AppState()
        self.state_callbacks: Dict[str, List[Callable]] = {}
        self.lock = threading.RLock()
        self.state_file = "app_state.json"
        
        # 加载保存的状态
        self.load_state()
    
    def get_state(self) -> AppState:
        """获取当前状态"""
        with self.lock:
            return self.state
    
    def update_state(self, **kwargs):
        """更新状态"""
        with self.lock:
            for key, value in kwargs.items():
                if hasattr(self.state, key):
                    old_value = getattr(self.state, key)
                    setattr(self.state, key, value)
                    self.state.last_updated = datetime.now()
                    
                    # 触发回调
                    self._trigger_callbacks(key, old_value, value)
        
        # 自动保存状态
        self.save_state()
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取状态值"""
        with self.lock:
            return getattr(self.state, key, default)
    
    def set(self, key: str, value: Any):
        """设置状态值"""
        self.update_state(**{key: value})
    
    def subscribe(self, key: str, callback: Callable):
        """订阅状态变化"""
        with self.lock:
            if key not in self.state_callbacks:
                self.state_callbacks[key] = []
            self.state_callbacks[key].append(callback)
    
    def unsubscribe(self, key: str, callback: Callable):
        """取消订阅状态变化"""
        with self.lock:
            if key in self.state_callbacks and callback in self.state_callbacks[key]:
                self.state_callbacks[key].remove(callback)
    
    def _trigger_callbacks(self, key: str, old_value: Any, new_value: Any):
        """触发状态变化回调"""
        if key in self.state_callbacks:
            for callback in self.state_callbacks[key]:
                try:
                    callback(key, old_value, new_value)
                except Exception as e:
                    print(f"状态回调执行失败: {e}")
    
    def save_state(self):
        """保存状态到文件"""
        try:
            with self.lock:
                state_dict = self.state.to_dict()
            
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(state_dict, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"保存状态失败: {e}")
    
    def load_state(self):
        """从文件加载状态"""
        try:
            if os.path.exists(self.state_file):
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    state_dict = json.load(f)
                
                with self.lock:
                    self.state = AppState.from_dict(state_dict)
        except Exception as e:
            print(f"加载状态失败: {e}")
    
    def get_state_summary(self) -> Dict[str, Any]:
        """获取状态摘要"""
        with self.lock:
            return {
                'current_sprite': f"{self.state.current_sprite_type}/{self.state.current_sprite_id}",
                'current_action': self.state.current_action,
                'current_direction': self.state.current_direction,
                'animation_status': "播放中" if self.state.animation_playing else "已停止",
                'animation_speed': self.state.animation_speed,
                'zoom_level': f"{self.state.zoom_level:.2f}x",
                'offset': f"({self.state.offset_x}, {self.state.offset_y})",
                'window_size': f"{self.state.window_width}x{self.state.window_height}",
                'performance': {
                    'memory_mb': f"{self.state.memory_usage_mb:.1f}MB",
                    'cpu_percent': f"{self.state.cpu_percent:.1f}%",
                    'cache_mb': f"{self.state.cache_size_mb:.1f}MB"
                },
                'enabled_plugins': len(self.state.enabled_plugins),
                'last_updated': self.state.last_updated.strftime("%Y-%m-%d %H:%M:%S")
            }
    
    def reset_state(self):
        """重置状态"""
        with self.lock:
            self.state = AppState()
        self.save_state()
    
    def export_state(self, file_path: str) -> bool:
        """导出状态到文件"""
        try:
            with self.lock:
                state_dict = self.state.to_dict()
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(state_dict, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"导出状态失败: {e}")
            return False
    
    def import_state(self, file_path: str) -> bool:
        """从文件导入状态"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                state_dict = json.load(f)
            
            with self.lock:
                self.state = AppState.from_dict(state_dict)
            
            self.save_state()
            return True
        except Exception as e:
            print(f"导入状态失败: {e}")
            return False
    
    def get_state_history(self) -> List[Dict[str, Any]]:
        """获取状态历史（这里可以实现状态历史记录功能）"""
        # 这里可以实现状态历史记录功能
        return []
    
    def update_performance_stats(self, memory_mb: float, cpu_percent: float, cache_mb: float):
        """更新性能统计"""
        self.update_state(
            memory_usage_mb=memory_mb,
            cpu_percent=cpu_percent,
            cache_size_mb=cache_mb
        )
    
    def get_current_sprite_info(self) -> Dict[str, Any]:
        """获取当前素材信息"""
        with self.lock:
            return {
                'type': self.state.current_sprite_type,
                'id': self.state.current_sprite_id,
                'action': self.state.current_action,
                'direction': self.state.current_direction,
                'full_path': f"{self.state.current_sprite_type}/{self.state.current_sprite_id}"
            }
    
    def set_current_sprite(self, sprite_type: str, sprite_id: str):
        """设置当前素材"""
        self.update_state(
            current_sprite_type=sprite_type,
            current_sprite_id=sprite_id
        )
    
    def set_animation_state(self, playing: bool, speed: int = None):
        """设置动画状态"""
        kwargs = {'animation_playing': playing}
        if speed is not None:
            kwargs['animation_speed'] = speed
        self.update_state(**kwargs)
    
    def set_display_options(self, show_walkable: bool = None, 
                           show_blocked: bool = None, 
                           show_masked: bool = None):
        """设置显示选项"""
        kwargs = {}
        if show_walkable is not None:
            kwargs['show_walkable'] = show_walkable
        if show_blocked is not None:
            kwargs['show_blocked'] = show_blocked
        if show_masked is not None:
            kwargs['show_masked'] = show_masked
        
        if kwargs:
            self.update_state(**kwargs)
    
    def set_view_settings(self, zoom_level: float = None, 
                         offset_x: int = None, 
                         offset_y: int = None):
        """设置视图设置"""
        kwargs = {}
        if zoom_level is not None:
            kwargs['zoom_level'] = zoom_level
        if offset_x is not None:
            kwargs['offset_x'] = offset_x
        if offset_y is not None:
            kwargs['offset_y'] = offset_y
        
        if kwargs:
            self.update_state(**kwargs)
    
    def set_window_size(self, width: int, height: int):
        """设置窗口大小"""
        self.update_state(window_width=width, window_height=height)
    
    def set_last_directory(self, directory: str):
        """设置最后使用的目录"""
        self.update_state(last_directory=directory)
    
    def add_enabled_plugin(self, plugin_name: str):
        """添加启用的插件"""
        with self.lock:
            if plugin_name not in self.state.enabled_plugins:
                self.state.enabled_plugins.append(plugin_name)
                self.state.last_updated = datetime.now()
        
        self.save_state()
    
    def remove_enabled_plugin(self, plugin_name: str):
        """移除启用的插件"""
        with self.lock:
            if plugin_name in self.state.enabled_plugins:
                self.state.enabled_plugins.remove(plugin_name)
                self.state.last_updated = datetime.now()
        
        self.save_state()
    
    def get_enabled_plugins(self) -> List[str]:
        """获取启用的插件列表"""
        with self.lock:
            return self.state.enabled_plugins.copy() 