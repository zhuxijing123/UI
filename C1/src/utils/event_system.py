# src/utils/event_system.py - 事件系统
from typing import Dict, List, Callable, Any, Optional
from collections import defaultdict
import threading
import time


class Event:
    """事件类"""
    
    def __init__(self, event_type: str, data: Any = None, source: str = None):
        self.event_type = event_type
        self.data = data
        self.source = source
        self.timestamp = time.time()
        self.id = f"{event_type}_{self.timestamp}_{id(self)}"
    
    def __str__(self):
        return f"Event({self.event_type}, source={self.source}, data={self.data})"


class EventSystem:
    """事件系统"""
    
    def __init__(self):
        self.listeners: Dict[str, List[Callable]] = defaultdict(list)
        self.async_listeners: Dict[str, List[Callable]] = defaultdict(list)
        self.event_history: List[Event] = []
        self.max_history = 1000
        self.lock = threading.RLock()
        self.enabled = True
    
    def subscribe(self, event_type: str, callback: Callable, async_execution: bool = False):
        """订阅事件"""
        with self.lock:
            if async_execution:
                self.async_listeners[event_type].append(callback)
            else:
                self.listeners[event_type].append(callback)
    
    def unsubscribe(self, event_type: str, callback: Callable):
        """取消订阅事件"""
        with self.lock:
            if event_type in self.listeners:
                if callback in self.listeners[event_type]:
                    self.listeners[event_type].remove(callback)
            
            if event_type in self.async_listeners:
                if callback in self.async_listeners[event_type]:
                    self.async_listeners[event_type].remove(callback)
    
    def publish(self, event_type: str, data: Any = None, source: str = None, async_execution: bool = False):
        """发布事件"""
        if not self.enabled:
            return
        
        event = Event(event_type, data, source)
        
        # 记录事件历史
        with self.lock:
            self.event_history.append(event)
            if len(self.event_history) > self.max_history:
                self.event_history.pop(0)
        
        # 同步执行
        if not async_execution:
            self._execute_sync_listeners(event)
        
        # 异步执行
        if async_execution or event_type in self.async_listeners:
            self._execute_async_listeners(event)
    
    def _execute_sync_listeners(self, event: Event):
        """执行同步监听器"""
        with self.lock:
            listeners = self.listeners[event.event_type].copy()
        
        for callback in listeners:
            try:
                callback(event)
            except Exception as e:
                print(f"同步事件监听器执行失败: {e}")
    
    def _execute_async_listeners(self, event: Event):
        """执行异步监听器"""
        def async_execution():
            with self.lock:
                listeners = self.async_listeners[event.event_type].copy()
            
            for callback in listeners:
                try:
                    callback(event)
                except Exception as e:
                    print(f"异步事件监听器执行失败: {e}")
        
        # 在新线程中执行
        thread = threading.Thread(target=async_execution, daemon=True)
        thread.start()
    
    def get_listeners(self, event_type: str = None) -> Dict[str, List[Callable]]:
        """获取监听器"""
        with self.lock:
            if event_type:
                return {
                    'sync': self.listeners.get(event_type, []),
                    'async': self.async_listeners.get(event_type, [])
                }
            else:
                return {
                    'sync': dict(self.listeners),
                    'async': dict(self.async_listeners)
                }
    
    def get_event_history(self, event_type: str = None, limit: int = None) -> List[Event]:
        """获取事件历史"""
        with self.lock:
            if event_type:
                history = [event for event in self.event_history if event.event_type == event_type]
            else:
                history = self.event_history.copy()
            
            if limit:
                history = history[-limit:]
            
            return history
    
    def clear_history(self):
        """清空事件历史"""
        with self.lock:
            self.event_history.clear()
    
    def get_event_stats(self) -> Dict[str, Any]:
        """获取事件统计信息"""
        with self.lock:
            stats = {
                'total_events': len(self.event_history),
                'event_types': {},
                'listeners': {
                    'sync': sum(len(listeners) for listeners in self.listeners.values()),
                    'async': sum(len(listeners) for listeners in self.async_listeners.values())
                }
            }
            
            # 统计事件类型
            for event in self.event_history:
                event_type = event.event_type
                if event_type not in stats['event_types']:
                    stats['event_types'][event_type] = 0
                stats['event_types'][event_type] += 1
            
            return stats
    
    def enable(self):
        """启用事件系统"""
        self.enabled = True
    
    def disable(self):
        """禁用事件系统"""
        self.enabled = False
    
    def is_enabled(self) -> bool:
        """检查事件系统是否启用"""
        return self.enabled


# 全局事件系统实例
event_system = EventSystem()


# 预定义的事件类型
class EventTypes:
    """事件类型常量"""
    # 应用程序事件
    APP_START = "app_start"
    APP_EXIT = "app_exit"
    APP_ERROR = "app_error"
    
    # 文件操作事件
    FILE_OPEN = "file_open"
    FILE_SAVE = "file_save"
    FILE_DELETE = "file_delete"
    
    # 图像处理事件
    IMAGE_LOAD = "image_load"
    IMAGE_SAVE = "image_save"
    IMAGE_PROCESS = "image_process"
    IMAGE_EXPORT = "image_export"
    
    # 地图事件
    MAP_LOAD = "map_load"
    MAP_SAVE = "map_save"
    MAP_EDIT = "map_edit"
    MAP_EXPORT = "map_export"
    
    # UI事件
    UI_UPDATE = "ui_update"
    UI_RESIZE = "ui_resize"
    UI_THEME_CHANGE = "ui_theme_change"
    
    # 插件事件
    PLUGIN_LOAD = "plugin_load"
    PLUGIN_UNLOAD = "plugin_unload"
    PLUGIN_EXECUTE = "plugin_execute"
    
    # 性能事件
    MEMORY_WARNING = "memory_warning"
    PERFORMANCE_UPDATE = "performance_update"
    CACHE_CLEAR = "cache_clear"


# 便捷函数
def subscribe(event_type: str, callback: Callable, async_execution: bool = False):
    """订阅事件（便捷函数）"""
    event_system.subscribe(event_type, callback, async_execution)


def unsubscribe(event_type: str, callback: Callable):
    """取消订阅事件（便捷函数）"""
    event_system.unsubscribe(event_type, callback)


def publish(event_type: str, data: Any = None, source: str = None, async_execution: bool = False):
    """发布事件（便捷函数）"""
    event_system.publish(event_type, data, source, async_execution)


def get_event_stats() -> Dict[str, Any]:
    """获取事件统计（便捷函数）"""
    return event_system.get_event_stats() 