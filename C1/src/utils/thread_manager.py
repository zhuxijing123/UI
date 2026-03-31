# src/utils/thread_manager.py - 线程管理器
import threading
import queue
import time
from typing import Callable, Any, Optional
from tkinter import messagebox


class ThreadManager:
    """线程管理器 - 处理耗时操作"""
    
    def __init__(self, logger):
        self.logger = logger
        self.threads = {}
        self.task_queue = queue.Queue()
        self.result_queue = queue.Queue()
        self.running = True
        
        # 启动工作线程
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
        
        self.logger.log("线程管理器初始化完成", "INFO")
    
    def _worker_loop(self):
        """工作线程循环"""
        while self.running:
            try:
                # 从队列获取任务
                task = self.task_queue.get(timeout=1.0)
                if task is None:
                    break
                
                func, args, kwargs, callback = task
                
                try:
                    # 执行任务
                    result = func(*args, **kwargs)
                    
                    # 将结果放入结果队列
                    self.result_queue.put((callback, result, None))
                    
                except Exception as e:
                    # 将错误放入结果队列
                    self.result_queue.put((callback, None, e))
                    
            except queue.Empty:
                continue
            except Exception as e:
                self.logger.log(f"工作线程错误: {e}", "ERROR")
    
    def submit_task(self, func: Callable, callback: Callable, *args, **kwargs):
        """提交任务到工作线程"""
        task = (func, args, kwargs, callback)
        self.task_queue.put(task)
        self.logger.log(f"提交任务: {func.__name__}", "DEBUG")
    
    def process_results(self):
        """处理结果队列中的结果"""
        while not self.result_queue.empty():
            try:
                callback, result, error = self.result_queue.get_nowait()
                
                if error:
                    self.logger.log(f"任务执行失败: {error}", "ERROR")
                    if callback:
                        callback(None, error)
                else:
                    if callback:
                        callback(result, None)
                        
            except queue.Empty:
                break
    
    def shutdown(self):
        """关闭线程管理器"""
        self.running = False
        self.task_queue.put(None)
        self.worker_thread.join(timeout=5.0)
        self.logger.log("线程管理器已关闭", "INFO")


class AsyncLoader:
    """异步加载器 - 处理素材加载"""
    
    def __init__(self, thread_manager: ThreadManager, logger):
        self.thread_manager = thread_manager
        self.logger = logger
        self.loading = False
    
    def load_sprite_async(self, sprite_manager, sprite_type, subtype, sprite_id, callback):
        """异步加载精灵"""
        if self.loading:
            self.logger.log("已有加载任务在进行中", "WARN")
            return
        
        self.loading = True
        
        def load_task():
            try:
                return sprite_manager.load_sprite(sprite_type, subtype, sprite_id)
            except Exception as e:
                self.logger.log(f"异步加载失败: {e}", "ERROR")
                return False
        
        def load_callback(result, error):
            self.loading = False
            if error:
                self.logger.log(f"加载回调错误: {error}", "ERROR")
            else:
                self.logger.log(f"异步加载完成: {result}", "INFO")
            if callback:
                callback(result, error)
        
        self.thread_manager.submit_task(load_task, load_callback)
    
    def load_h5_map_async(self, sprite_manager, map_id, callback):
        """异步加载H5地图"""
        print(f"AsyncLoader: 开始异步加载H5地图，ID: {map_id}")
        self.logger.log(f"AsyncLoader: 开始异步加载H5地图 {map_id}", "INFO")
        
        if self.loading:
            self.logger.log("已有加载任务在进行中", "WARN")
            return
        
        self.loading = True
        self.logger.log(f"AsyncLoader: 提交H5地图加载任务到后台线程: {map_id}", "INFO")
        
        def load_task():
            try:
                self.logger.log(f"AsyncLoader: 后台线程开始加载H5地图: {map_id}", "INFO")
                result = sprite_manager.load_h5_map_data(map_id)
                self.logger.log(f"AsyncLoader: 后台线程H5地图加载完成: {map_id}, 结果: {result is not None}", "INFO")
                return result
            except Exception as e:
                self.logger.log(f"AsyncLoader: 后台线程加载H5地图失败: {e}", "ERROR")
                return False
        
        def load_callback(result, error):
            self.loading = False
            if error:
                self.logger.log(f"AsyncLoader: H5地图加载回调错误: {error}", "ERROR")
            else:
                self.logger.log(f"AsyncLoader: H5地图加载回调完成: {result is not None}", "INFO")
            if callback:
                self.logger.log("AsyncLoader: 调用用户回调函数", "INFO")
                callback(result, error)
        
        self.thread_manager.submit_task(load_task, load_callback)
    
    def refresh_ids_async(self, sprite_manager, sprite_type, callback):
        """异步刷新ID列表"""
        def refresh_task():
            try:
                return sprite_manager.get_sprite_ids(sprite_type)
            except Exception as e:
                self.logger.log(f"异步刷新失败: {e}", "ERROR")
                return []
        
        def refresh_callback(result, error):
            if error:
                self.logger.log(f"刷新回调错误: {error}", "ERROR")
            else:
                self.logger.log(f"异步刷新完成: 找到 {len(result)} 个ID", "INFO")
            if callback:
                callback(result, error)
        
        self.thread_manager.submit_task(refresh_task, refresh_callback)
    
    def split_sprite_async(self, splitter, sprite_manager, sprite_type, sprite_id, output_dir, callback):
        """异步拆图"""
        def split_task():
            try:
                return splitter.split_single_sprite(sprite_manager, sprite_type, sprite_id, output_dir)
            except Exception as e:
                self.logger.log(f"异步拆图失败: {e}", "ERROR")
                return False
        
        def split_callback(result, error):
            if error:
                self.logger.log(f"拆图回调错误: {error}", "ERROR")
            else:
                self.logger.log(f"异步拆图完成: {result}", "INFO")
            if callback:
                callback(result, error)
        
        self.thread_manager.submit_task(split_task, split_callback)