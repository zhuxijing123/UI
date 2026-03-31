# src/utils/memory_manager.py - 内存管理和性能监控系统
import psutil
import time
import threading
from typing import Dict, List, Optional, Callable
from collections import defaultdict
import gc


class MemoryManager:
    """内存管理系统"""
    
    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.cache_size_limit = config_manager.get_max_cache_size()
        self.current_cache_size = 0
        self.cache_items = {}  # 缓存项: {key: (size, timestamp, data)}
        self.performance_stats = defaultdict(list)
        self.monitoring = False
        self.monitor_thread = None
        self.cleanup_interval = config_manager.get('performance.cache_cleanup_interval', 300)
        self.last_cleanup = time.time()
        
        # 性能监控回调
        self.memory_callbacks = []
        self.performance_callbacks = []
    
    def start_monitoring(self):
        """开始性能监控"""
        if not self.monitoring:
            self.monitoring = True
            self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.monitor_thread.start()
    
    def stop_monitoring(self):
        """停止性能监控"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join()
    
    def _monitor_loop(self):
        """监控循环"""
        while self.monitoring:
            try:
                # 收集性能数据
                self._collect_performance_data()
                
                # 检查内存使用
                self._check_memory_usage()
                
                # 定期清理缓存
                current_time = time.time()
                if current_time - self.last_cleanup > self.cleanup_interval:
                    self._cleanup_old_cache()
                    self.last_cleanup = current_time
                
                time.sleep(5)  # 每5秒检查一次
            except Exception as e:
                print(f"性能监控错误: {e}")
    
    def _collect_performance_data(self):
        """收集性能数据"""
        try:
            process = psutil.Process()
            
            # 内存使用
            memory_info = process.memory_info()
            memory_percent = process.memory_percent()
            
            # CPU使用
            cpu_percent = process.cpu_percent()
            
            # 缓存统计
            cache_stats = {
                'cache_size': self.current_cache_size,
                'cache_items': len(self.cache_items),
                'cache_hit_rate': self._calculate_cache_hit_rate()
            }
            
            # 记录性能数据
            timestamp = time.time()
            self.performance_stats['memory_usage'].append((timestamp, memory_info.rss))
            self.performance_stats['memory_percent'].append((timestamp, memory_percent))
            self.performance_stats['cpu_percent'].append((timestamp, cpu_percent))
            self.performance_stats['cache_size'].append((timestamp, self.current_cache_size))
            
            # 保持最近1000个数据点
            for key in self.performance_stats:
                if len(self.performance_stats[key]) > 1000:
                    self.performance_stats[key] = self.performance_stats[key][-1000:]
            
            # 触发回调
            self._trigger_memory_callbacks(memory_info.rss, memory_percent, cpu_percent)
            
        except Exception as e:
            print(f"收集性能数据失败: {e}")
    
    def _check_memory_usage(self):
        """检查内存使用情况"""
        try:
            process = psutil.Process()
            memory_percent = process.memory_percent()
            
            # 如果内存使用超过80%，强制清理
            if memory_percent > 80:
                self._force_cleanup()
            
            # 如果缓存大小超过限制，清理旧缓存
            if self.current_cache_size > self.cache_size_limit:
                self._cleanup_old_cache()
                
        except Exception as e:
            print(f"检查内存使用失败: {e}")
    
    def _force_cleanup(self):
        """强制清理内存"""
        print("内存使用过高，执行强制清理...")
        
        # 清理缓存
        self.cache_items.clear()
        self.current_cache_size = 0
        
        # 强制垃圾回收
        gc.collect()
        
        # 清理性能统计数据
        for key in self.performance_stats:
            if len(self.performance_stats[key]) > 100:
                self.performance_stats[key] = self.performance_stats[key][-100:]
    
    def _cleanup_old_cache(self):
        """清理旧缓存"""
        if not self.cache_items:
            return
        
        current_time = time.time()
        items_to_remove = []
        
        # 按时间戳排序，移除最旧的缓存
        sorted_items = sorted(self.cache_items.items(), 
                            key=lambda x: x[1][1])  # 按timestamp排序
        
        for key, (size, timestamp, data) in sorted_items:
            # 移除超过1小时的缓存
            if current_time - timestamp > 3600:
                items_to_remove.append(key)
                self.current_cache_size -= size
            else:
                break
        
        # 移除标记的缓存项
        for key in items_to_remove:
            del self.cache_items[key]
        
        if items_to_remove:
            print(f"清理了 {len(items_to_remove)} 个缓存项，释放 {sum(self.cache_items[k][0] for k in items_to_remove)} 字节")
    
    def _calculate_cache_hit_rate(self) -> float:
        """计算缓存命中率"""
        # 这里可以实现更复杂的缓存命中率计算
        # 暂时返回一个简单的估算值
        return 0.8  # 80% 命中率
    
    def add_to_cache(self, key: str, data: any, size: int = None):
        """添加数据到缓存"""
        if size is None:
            # 估算大小
            size = self._estimate_size(data)
        
        # 检查缓存大小限制
        while self.current_cache_size + size > self.cache_size_limit and self.cache_items:
            # 移除最旧的缓存项
            oldest_key = min(self.cache_items.keys(), 
                           key=lambda k: self.cache_items[k][1])
            old_size = self.cache_items[oldest_key][0]
            del self.cache_items[oldest_key]
            self.current_cache_size -= old_size
        
        # 添加新缓存项
        self.cache_items[key] = (size, time.time(), data)
        self.current_cache_size += size
    
    def get_from_cache(self, key: str) -> Optional[any]:
        """从缓存获取数据"""
        if key in self.cache_items:
            # 更新访问时间
            size, _, data = self.cache_items[key]
            self.cache_items[key] = (size, time.time(), data)
            return data
        return None
    
    def remove_from_cache(self, key: str):
        """从缓存移除数据"""
        if key in self.cache_items:
            size = self.cache_items[key][0]
            del self.cache_items[key]
            self.current_cache_size -= size
    
    def clear_cache(self):
        """清空缓存"""
        self.cache_items.clear()
        self.current_cache_size = 0
    
    def _estimate_size(self, data: any) -> int:
        """估算数据大小"""
        try:
            import sys
            return sys.getsizeof(data)
        except:
            return 1024  # 默认1KB
    
    def get_memory_usage(self) -> Dict[str, float]:
        """获取内存使用情况"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            
            return {
                'rss': memory_info.rss,  # 物理内存
                'vms': memory_info.vms,  # 虚拟内存
                'percent': process.memory_percent(),
                'available': psutil.virtual_memory().available,
                'total': psutil.virtual_memory().total
            }
        except Exception as e:
            print(f"获取内存使用失败: {e}")
            return {}
    
    def get_performance_stats(self) -> Dict[str, List]:
        """获取性能统计数据"""
        return dict(self.performance_stats)
    
    def get_cache_stats(self) -> Dict[str, any]:
        """获取缓存统计"""
        return {
            'cache_size': self.current_cache_size,
            'cache_limit': self.cache_size_limit,
            'cache_items': len(self.cache_items),
            'cache_usage_percent': (self.current_cache_size / self.cache_size_limit) * 100
        }
    
    def add_memory_callback(self, callback: Callable):
        """添加内存监控回调"""
        self.memory_callbacks.append(callback)
    
    def add_performance_callback(self, callback: Callable):
        """添加性能监控回调"""
        self.performance_callbacks.append(callback)
    
    def _trigger_memory_callbacks(self, rss: int, memory_percent: float, cpu_percent: float):
        """触发内存监控回调"""
        for callback in self.memory_callbacks:
            try:
                callback(rss, memory_percent, cpu_percent)
            except Exception as e:
                print(f"内存回调执行失败: {e}")
    
    def get_performance_summary(self) -> Dict[str, any]:
        """获取性能摘要"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            
            return {
                'memory_usage_mb': memory_info.rss / 1024 / 1024,
                'memory_percent': process.memory_percent(),
                'cpu_percent': process.cpu_percent(),
                'cache_size_mb': self.current_cache_size / 1024 / 1024,
                'cache_items': len(self.cache_items),
                'uptime_seconds': time.time() - process.create_time()
            }
        except Exception as e:
            print(f"获取性能摘要失败: {e}")
            return {} 