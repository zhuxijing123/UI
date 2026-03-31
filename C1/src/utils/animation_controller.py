# src/utils/animation_controller.py - 确保完整实现
import threading
import time
from typing import Optional, Callable


class AnimationController:
    """动画控制器"""

    def __init__(self, logger):
        self.logger = logger
        self._is_playing = False
        self._speed = 100  # ms per frame
        self._frame_callback: Optional[Callable] = None
        self._animation_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def set_frame_callback(self, callback: Callable):
        """设置帧回调函数"""
        self._frame_callback = callback
        self.logger.log("设置动画帧回调函数", "DEBUG")

    def set_speed(self, speed_ms: int):
        """设置动画速度（毫秒/帧）"""
        self._speed = max(10, min(1000, speed_ms))
        self.logger.log(f"动画速度设置为: {self._speed}ms", "DEBUG")

    def start(self):
        """开始播放动画"""
        if self._is_playing:
            return

        if not self._frame_callback:
            self.logger.log("动画回调函数未设置", "WARN")
            return

        self._is_playing = True
        self._stop_event.clear()

        self._animation_thread = threading.Thread(target=self._animation_loop, daemon=True)
        self._animation_thread.start()
        self.logger.log("动画播放开始", "DEBUG")

    def stop(self):
        """停止播放动画"""
        if not self._is_playing:
            return

        self._is_playing = False
        self._stop_event.set()

        if self._animation_thread and self._animation_thread.is_alive():
            self._animation_thread.join(timeout=1.0)

        self.logger.log("动画播放停止", "DEBUG")

    def is_playing(self) -> bool:
        """获取播放状态"""
        return self._is_playing

    def _animation_loop(self):
        """动画循环"""
        while self._is_playing and not self._stop_event.is_set():
            if self._frame_callback:
                try:
                    self._frame_callback()
                except Exception as e:
                    self.logger.log(f"动画帧回调执行失败: {e}", "ERROR")
                    break

            # 等待指定时间
            if self._stop_event.wait(timeout=self._speed / 1000.0):
                break

        self._is_playing = False
        self.logger.log("动画循环结束", "DEBUG")