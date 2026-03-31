# src/utils/logger.py - 日志工具类
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from datetime import datetime
from typing import List, Tuple
import threading


class Logger:
    """日志系统"""

    def __init__(self, master):
        self.master = master
        self.visible = False
        self.log_entries: List[Tuple[str, str, str, str]] = []  # timestamp, level, message, formatted
        self.log_queue = []
        self.thread_lock = threading.Lock()

        # 日志级别颜色
        self.level_colors = {
            'INFO': '#4CAF50',  # 绿色
            'WARN': '#FF9800',  # 橙色
            'ERROR': '#F44336',  # 红色
            'DEBUG': '#2196F3'  # 蓝色
        }

        self.setup_ui()
        self._start_log_processor()

    def setup_ui(self):
        """设置日志界面"""
        self.window = tk.Toplevel(self.master)
        self.window.title("日志窗口")
        self.window.geometry("1000x600")
        self.window.withdraw()  # 初始隐藏

        # 主框架
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # 工具栏
        self.setup_toolbar(main_frame)

        # 日志显示区域
        self.setup_log_display(main_frame)

        # 窗口关闭事件
        self.window.protocol("WM_DELETE_WINDOW", self.hide)

    def setup_toolbar(self, parent):
        """设置工具栏"""
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, pady=(0, 5))

        # 操作按钮
        ttk.Button(toolbar, text="清除日志", command=self.clear_logs).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(toolbar, text="复制所有", command=self.copy_all_logs).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(toolbar, text="导出日志", command=self.export_logs).pack(side=tk.LEFT, padx=(0, 5))

        # 分隔符
        ttk.Separator(toolbar, orient='vertical').pack(side=tk.LEFT, fill=tk.Y, padx=10)

        # 过滤控件
        ttk.Label(toolbar, text="级别过滤:").pack(side=tk.LEFT, padx=(0, 5))
        self.filter_var = tk.StringVar(value="ALL")
        filter_combo = ttk.Combobox(
            toolbar,
            textvariable=self.filter_var,
            values=["ALL", "INFO", "WARN", "ERROR", "DEBUG"],
            width=8,
            state="readonly"
        )
        filter_combo.pack(side=tk.LEFT, padx=(0, 5))
        filter_combo.bind("<<ComboboxSelected>>", self.apply_filter)

        # 自动滚动选项
        self.auto_scroll_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            toolbar,
            text="自动滚动",
            variable=self.auto_scroll_var
        ).pack(side=tk.LEFT, padx=(10, 0))

    def setup_log_display(self, parent):
        """设置日志显示区域"""
        text_frame = ttk.Frame(parent)
        text_frame.pack(fill=tk.BOTH, expand=True)

        # 滚动条
        scrollbar = ttk.Scrollbar(text_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # 文本框
        self.text_widget = tk.Text(
            text_frame,
            state='disabled',
            bg="#1e1e1e",
            fg="#d4d4d4",
            font=("Consolas", 9),
            yscrollcommand=scrollbar.set,
            wrap=tk.WORD
        )
        self.text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar.config(command=self.text_widget.yview)

        # 配置文本标签
        for level, color in self.level_colors.items():
            self.text_widget.tag_config(level, foreground=color)

    def _start_log_processor(self):
        """启动日志处理器"""

        def process_logs():
            with self.thread_lock:
                if self.log_queue:
                    for timestamp, level, message, formatted in self.log_queue:
                        self.log_entries.append((timestamp, level, message, formatted))
                        if self.visible and self._should_show_log(level):
                            self._add_log_to_text(formatted, level)
                    self.log_queue.clear()

            self.master.after(100, process_logs)

        process_logs()

    def log(self, message: str, level: str = 'INFO'):
        """记录日志"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        formatted = f"[{timestamp}] [{level:5}] {message}"

        with self.thread_lock:
            self.log_queue.append((timestamp, level, message, formatted))

    def _should_show_log(self, level: str) -> bool:
        """判断是否应该显示此级别的日志"""
        filter_level = self.filter_var.get()
        return filter_level == "ALL" or filter_level == level

    def _add_log_to_text(self, formatted: str, level: str):
        """添加日志到文本框"""
        self.text_widget.config(state='normal')
        self.text_widget.insert(tk.END, formatted + '\n', level)
        if self.auto_scroll_var.get():
            self.text_widget.see(tk.END)
        self.text_widget.config(state='disabled')

    def apply_filter(self, event=None):
        """应用日志过滤"""
        self._clear_text()
        for timestamp, level, message, formatted in self.log_entries:
            if self._should_show_log(level):
                self._add_log_to_text(formatted, level)

    def _clear_text(self):
        """清除文本框内容"""
        self.text_widget.config(state='normal')
        self.text_widget.delete(1.0, tk.END)
        self.text_widget.config(state='disabled')

    def clear_logs(self):
        """清除所有日志"""
        with self.thread_lock:
            self.log_entries.clear()
            self.log_queue.clear()
        self._clear_text()
        self.log("日志已清除", "INFO")

    def copy_all_logs(self):
        """复制所有日志到剪贴板"""
        if not self.log_entries:
            messagebox.showinfo("提示", "没有日志可复制")
            return

        log_text = ""
        filter_level = self.filter_var.get()
        for timestamp, level, message, formatted in self.log_entries:
            if filter_level == "ALL" or filter_level == level:
                log_text += formatted + '\n'

        if log_text:
            self.window.clipboard_clear()
            self.window.clipboard_append(log_text)
            messagebox.showinfo("成功", "日志已复制到剪贴板")
        else:
            messagebox.showinfo("提示", "没有符合过滤条件的日志")

    def export_logs(self):
        """导出日志到文件"""
        if not self.log_entries:
            messagebox.showinfo("提示", "没有日志可导出")
            return

        filename = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("文本文件", "*.txt"), ("所有文件", "*.*")],
            title="导出日志"
        )

        if filename:
            try:
                with open(filename, 'w', encoding='utf-8') as f:
                    filter_level = self.filter_var.get()
                    for timestamp, level, message, formatted in self.log_entries:
                        if filter_level == "ALL" or filter_level == level:
                            f.write(formatted + '\n')
                messagebox.showinfo("成功", f"日志已导出到: {filename}")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {e}")

    def show(self):
        """显示日志窗口"""
        # 立即显示窗口，不等待数据加载
        self.window.deiconify()
        self.window.lift()
        self.visible = True
        
        # 异步更新日志内容
        self.master.after(100, self._update_log_display)
    
    def _update_log_display(self):
        """异步更新日志显示"""
        try:
            # 清空现有内容
            self._clear_text()
            
            # 分批添加日志条目，避免UI卡顿
            def add_logs_batch(start_index=0):
                batch_size = 20  # 每批处理20条日志
                end_index = min(start_index + batch_size, len(self.log_entries))
                
                for i in range(start_index, end_index):
                    timestamp, level, message, formatted = self.log_entries[i]
                    if self._should_show_log(level):
                        self._add_log_to_text(formatted, level)
                
                # 如果还有更多日志，继续分批处理
                if end_index < len(self.log_entries):
                    self.master.after(10, lambda: add_logs_batch(end_index))
                else:
                    # 所有日志添加完成后，滚动到底部
                    if self.auto_scroll_var.get():
                        self.text_widget.see(tk.END)
            
            # 开始分批添加
            self.master.after(1, lambda: add_logs_batch())
            
        except Exception as e:
            print(f"更新日志显示失败: {e}")

    def hide(self):
        """隐藏日志窗口"""
        self.window.withdraw()
        self.visible = False

    def toggle(self):
        """切换日志窗口显示状态"""
        if self.visible:
            self.hide()
        else:
            self.show()