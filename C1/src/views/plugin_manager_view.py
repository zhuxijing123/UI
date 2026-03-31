# src/views/plugin_manager_view.py - 插件管理界面
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Dict, List
import os

# 导入代码编辑器视图
from .code_editor_view import CodeEditorView


class PluginManagerView:
    """插件管理界面"""
    
    def __init__(self, root, plugin_manager, config_manager):
        self.root = root
        self.plugin_manager = plugin_manager
        self.config_manager = config_manager
        
        self.window = None
        self.plugin_tree = None
        self.refresh_button = None
        self.enable_button = None
        self.disable_button = None
        self.reload_button = None
        
        # 插件信息缓存
        self.plugin_info_cache: Dict[str, Dict] = {}
        
        # 代码编辑器实例
        self.code_editor = None
    
    def show_plugin_manager(self):
        """显示插件管理器窗口"""
        if self.window is None or not self.window.winfo_exists():
            self.create_plugin_manager_window()
        else:
            self.window.deiconify()
            self.window.lift()
    
    def create_plugin_manager_window(self):
        """创建插件管理器窗口"""
        self.window = tk.Toplevel(self.root)
        self.window.title("插件管理器")
        self.window.geometry("1000x700")
        self.window.protocol("WM_DELETE_WINDOW", self.window.withdraw)
        
        # 创建主框架
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 创建工具栏
        self.create_toolbar(main_frame)
        
        # 创建插件列表
        self.create_plugin_list(main_frame)
        
        # 创建详细信息面板
        self.create_detail_panel(main_frame)
        
        # 创建状态栏
        self.create_status_bar(main_frame)
        
        # 加载插件信息
        self.refresh_plugin_list()
    
    def create_toolbar(self, parent):
        """创建工具栏"""
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        # 操作按钮
        self.refresh_button = ttk.Button(toolbar, text="刷新", command=self.refresh_plugin_list)
        self.refresh_button.pack(side=tk.LEFT, padx=(0, 5))
        
        # 新建插件按钮
        self.new_plugin_button = ttk.Button(toolbar, text="新建插件", command=self.create_new_plugin)
        self.new_plugin_button.pack(side=tk.LEFT, padx=(0, 5))
        
        # 删除插件按钮
        self.delete_plugin_button = ttk.Button(toolbar, text="删除插件", command=self.delete_selected_plugin)
        self.delete_plugin_button.pack(side=tk.LEFT, padx=(0, 5))
        
        self.enable_button = ttk.Button(toolbar, text="启用", command=self.enable_selected_plugin)
        self.enable_button.pack(side=tk.LEFT, padx=(0, 5))
        
        self.disable_button = ttk.Button(toolbar, text="停用", command=self.disable_selected_plugin)
        self.disable_button.pack(side=tk.LEFT, padx=(0, 5))
        
        self.reload_button = ttk.Button(toolbar, text="重新加载", command=self.reload_selected_plugin)
        self.reload_button.pack(side=tk.LEFT, padx=(0, 5))
        
        # 分隔符
        ttk.Separator(toolbar, orient='vertical').pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 搜索框
        ttk.Label(toolbar, text="搜索:").pack(side=tk.LEFT, padx=(0, 5))
        self.search_var = tk.StringVar()
        self.search_var.trace("w", self.on_search_change)
        search_entry = ttk.Entry(toolbar, textvariable=self.search_var, width=20)
        search_entry.pack(side=tk.LEFT, padx=(0, 5))
        
        # 添加操作提示
        ttk.Label(toolbar, text="💡 双击插件快速切换状态", 
                 font=("Arial", 9), foreground="blue").pack(side=tk.RIGHT, padx=5)
    
    def create_plugin_list(self, parent):
        """创建插件列表"""
        # 创建左右分栏
        list_frame = ttk.Frame(parent)
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        # 左侧：插件列表
        left_frame = ttk.Frame(list_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))
        
        # 插件列表标题
        ttk.Label(left_frame, text="插件列表", font=("Arial", 12, "bold")).pack(pady=(0, 5))
        
        # 添加提示信息
        ttk.Label(left_frame, text="💡 双击插件可快速启用/停用", 
                 font=("Arial", 9), foreground="gray").pack(pady=(0, 5))
        
        # 创建树形视图
        columns = ("状态", "名称", "版本", "作者")
        self.plugin_tree = ttk.Treeview(left_frame, columns=columns, show="tree headings", height=15)
        
        # 设置列标题
        self.plugin_tree.heading("#0", text="插件")
        for col in columns:
            self.plugin_tree.heading(col, text=col)
            self.plugin_tree.column(col, width=80)
        
        # 设置列宽
        self.plugin_tree.column("#0", width=200)
        self.plugin_tree.column("状态", width=60)
        self.plugin_tree.column("版本", width=80)
        self.plugin_tree.column("作者", width=100)
        
        # 添加滚动条
        tree_scroll = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.plugin_tree.yview)
        self.plugin_tree.configure(yscrollcommand=tree_scroll.set)
        
        self.plugin_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定选择事件
        self.plugin_tree.bind("<<TreeviewSelect>>", self.on_plugin_select)
        
        # 绑定双击事件
        self.plugin_tree.bind("<Double-1>", self.on_plugin_double_click)
        
        # 右侧：详细信息
        right_frame = ttk.Frame(list_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(5, 0))
        
        # 详细信息标题
        ttk.Label(right_frame, text="详细信息", font=("Arial", 12, "bold")).pack(pady=(0, 5))
        
        # 详细信息文本框
        self.detail_text = tk.Text(right_frame, width=30, height=20, wrap=tk.WORD)
        detail_scroll = ttk.Scrollbar(right_frame, orient=tk.VERTICAL, command=self.detail_text.yview)
        self.detail_text.configure(yscrollcommand=detail_scroll.set)
        
        self.detail_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        detail_scroll.pack(side=tk.RIGHT, fill=tk.Y)
    
    def create_detail_panel(self, parent):
        """创建详细信息面板"""
        detail_frame = ttk.LabelFrame(parent, text="插件操作")
        detail_frame.pack(fill=tk.X, pady=(10, 0))
        
        # 操作按钮
        btn_frame = ttk.Frame(detail_frame)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(btn_frame, text="执行插件", command=self.execute_selected_plugin).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(btn_frame, text="查看代码", command=self.view_plugin_code).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(btn_frame, text="查看插件目录", command=self.open_plugin_directory).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(btn_frame, text="导出插件配置", command=self.export_plugin_config).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(btn_frame, text="导入插件配置", command=self.import_plugin_config).pack(side=tk.LEFT)
    
    def create_status_bar(self, parent):
        """创建状态栏"""
        status_frame = ttk.Frame(parent)
        status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.status_label = ttk.Label(status_frame, text="就绪")
        self.status_label.pack(side=tk.LEFT, padx=5)
        
        # 统计信息
        self.stats_label = ttk.Label(status_frame, text="")
        self.stats_label.pack(side=tk.RIGHT, padx=5)
    
    def refresh_plugin_list(self):
        """刷新插件列表"""
        # 清空树形视图
        for item in self.plugin_tree.get_children():
            self.plugin_tree.delete(item)
        
        # 获取所有插件
        all_plugins = self.plugin_manager.get_all_plugins()
        enabled_plugins = self.plugin_manager.get_enabled_plugins()
        
        # 更新插件信息缓存
        self.plugin_info_cache.clear()
        
        # 添加插件到树形视图
        for plugin_id, plugin in all_plugins.items():
            info = plugin.get_info()
            self.plugin_info_cache[plugin_id] = info
            
            # 状态图标和文本
            if plugin.enabled:
                status_icon = "✅"
                status_text = "已启用"
                status_color = "green"
            else:
                status_icon = "❌"
                status_text = "已停用"
                status_color = "red"
            
            # 插入到树形视图
            item = self.plugin_tree.insert("", "end", text=plugin.name,
                                         values=(f"{status_icon} {status_text}", plugin.name, plugin.version, plugin.author))
            
            # 设置行的标签，用于颜色显示
            if plugin.enabled:
                self.plugin_tree.tag_configure("enabled", foreground="green")
                self.plugin_tree.item(item, tags=("enabled",))
            else:
                self.plugin_tree.tag_configure("disabled", foreground="red")
                self.plugin_tree.item(item, tags=("disabled",))
        
        # 更新统计信息
        total_plugins = len(all_plugins)
        enabled_count = len(enabled_plugins)
        self.stats_label.config(text=f"总计: {total_plugins} | 启用: {enabled_count} | 停用: {total_plugins - enabled_count}")
        
        self.status_label.config(text=f"已刷新插件列表，共 {total_plugins} 个插件")
    
    def on_plugin_select(self, event):
        """插件选择事件"""
        selection = self.plugin_tree.selection()
        if selection:
            item = selection[0]
            plugin_name = self.plugin_tree.item(item, "text")
            
            # 查找对应的插件
            plugin = None
            for plugin_id, info in self.plugin_info_cache.items():
                if info['name'] == plugin_name:
                    plugin = self.plugin_manager.get_plugin(plugin_id)
                    break
            
            if plugin:
                self.show_plugin_details(plugin)
    
    def on_plugin_double_click(self, event):
        """插件双击事件"""
        selection = self.plugin_tree.selection()
        if selection:
            item = selection[0]
            plugin_name = self.plugin_tree.item(item, "text")
            
            # 查找对应的插件
            plugin = None
            plugin_id = None
            for pid, info in self.plugin_info_cache.items():
                if info['name'] == plugin_name:
                    plugin = self.plugin_manager.get_plugin(pid)
                    plugin_id = pid
                    break
            
            if plugin:
                if plugin.enabled:
                    # 停用插件
                    if self.plugin_manager.disable_plugin(plugin_id):
                        self.status_label.config(text=f"已停用插件: {plugin_name}")
                        # 添加视觉反馈
                        self.plugin_tree.item(item, tags=("disabled",))
                        self.plugin_tree.set(item, "状态", "❌ 已停用")
                    else:
                        self.status_label.config(text=f"停用插件失败: {plugin_name}")
                else:
                    # 启用插件
                    if self.plugin_manager.enable_plugin(plugin_id):
                        self.status_label.config(text=f"已启用插件: {plugin_name}")
                        # 添加视觉反馈
                        self.plugin_tree.item(item, tags=("enabled",))
                        self.plugin_tree.set(item, "状态", "✅ 已启用")
                    else:
                        self.status_label.config(text=f"启用插件失败: {plugin_name}")
                
                # 更新统计信息
                all_plugins = self.plugin_manager.get_all_plugins()
                enabled_plugins = self.plugin_manager.get_enabled_plugins()
                total_plugins = len(all_plugins)
                enabled_count = len(enabled_plugins)
                self.stats_label.config(text=f"总计: {total_plugins} | 启用: {enabled_count} | 停用: {total_plugins - enabled_count}")
                
                # 更新详细信息
                self.show_plugin_details(plugin)
    
    def show_plugin_details(self, plugin):
        """显示插件详细信息"""
        info = plugin.get_info()
        
        details = f"""插件详细信息:

名称: {info['name']}
ID: {info['id']}
版本: {info['version']}
作者: {info['author']}
状态: {'启用' if info['enabled'] else '停用'}
描述: {plugin.description}

插件类型: {type(plugin).__name__}
插件目录: {self.plugin_manager.get_plugin_directory()}

功能说明:
- 支持图像处理
- 支持图层操作
- 支持滤镜效果
- 支持撤销重做
- 支持多种格式

使用说明:
1. 点击"启用"按钮启用插件
2. 点击"执行插件"运行功能
3. 在插件界面中进行操作
4. 完成后保存结果"""
        
        self.detail_text.delete(1.0, tk.END)
        self.detail_text.insert(1.0, details)
    
    def enable_selected_plugin(self):
        """启用选中的插件"""
        selection = self.plugin_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择一个插件")
            return
        
        item = selection[0]
        plugin_name = self.plugin_tree.item(item, "text")
        
        # 查找对应的插件ID
        plugin_id = None
        for pid, info in self.plugin_info_cache.items():
            if info['name'] == plugin_name:
                plugin_id = pid
                break
        
        if plugin_id:
            if self.plugin_manager.enable_plugin(plugin_id):
                self.refresh_plugin_list()
                self.status_label.config(text=f"已启用插件: {plugin_name}")
            else:
                messagebox.showerror("错误", f"启用插件失败: {plugin_name}")
    
    def disable_selected_plugin(self):
        """停用选中的插件"""
        selection = self.plugin_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择一个插件")
            return
        
        item = selection[0]
        plugin_name = self.plugin_tree.item(item, "text")
        
        # 查找对应的插件ID
        plugin_id = None
        for pid, info in self.plugin_info_cache.items():
            if info['name'] == plugin_name:
                plugin_id = pid
                break
        
        if plugin_id:
            if self.plugin_manager.disable_plugin(plugin_id):
                self.refresh_plugin_list()
                self.status_label.config(text=f"已停用插件: {plugin_name}")
            else:
                messagebox.showerror("错误", f"停用插件失败: {plugin_name}")
    
    def reload_selected_plugin(self):
        """重新加载选中的插件"""
        selection = self.plugin_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择一个插件")
            return
        
        item = selection[0]
        plugin_name = self.plugin_tree.item(item, "text")
        
        # 查找对应的插件ID
        plugin_id = None
        for pid, info in self.plugin_info_cache.items():
            if info['name'] == plugin_name:
                plugin_id = pid
                break
        
        if plugin_id:
            if self.plugin_manager.reload_plugin(plugin_id):
                self.refresh_plugin_list()
                self.status_label.config(text=f"已重新加载插件: {plugin_name}")
            else:
                messagebox.showerror("错误", f"重新加载插件失败: {plugin_name}")
    
    def execute_selected_plugin(self):
        """执行选中的插件"""
        selection = self.plugin_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择一个插件")
            return
        
        item = selection[0]
        plugin_name = self.plugin_tree.item(item, "text")
        
        # 查找对应的插件ID
        plugin_id = None
        for pid, info in self.plugin_info_cache.items():
            if info['name'] == plugin_name:
                plugin_id = pid
                break
        
        if plugin_id:
            plugin = self.plugin_manager.get_plugin(plugin_id)
            if plugin and plugin.enabled:
                try:
                    result = self.plugin_manager.execute_plugin(plugin_id)
                    if result:
                        self.status_label.config(text=f"插件执行成功: {plugin_name}")
                    else:
                        self.status_label.config(text=f"插件执行完成: {plugin_name}")
                except Exception as e:
                    messagebox.showerror("错误", f"执行插件失败: {e}")
            else:
                messagebox.showwarning("警告", f"插件未启用: {plugin_name}")
    
    def open_plugin_directory(self):
        """打开插件目录"""
        plugin_dir = self.plugin_manager.get_plugin_directory()
        if os.path.exists(plugin_dir):
            try:
                os.startfile(plugin_dir)  # Windows
            except AttributeError:
                import subprocess
                subprocess.run(["open", plugin_dir])  # macOS
            except:
                import subprocess
                subprocess.run(["xdg-open", plugin_dir])  # Linux
            
            self.status_label.config(text=f"已打开插件目录: {plugin_dir}")
        else:
            messagebox.showerror("错误", f"插件目录不存在: {plugin_dir}")
    
    def export_plugin_config(self):
        """导出插件配置"""
        enabled_plugins = self.config_manager.get_enabled_plugins()
        
        config_data = {
            "enabled_plugins": enabled_plugins,
            "plugin_directory": self.plugin_manager.get_plugin_directory(),
            "auto_load_plugins": True
        }
        
        try:
            import json
            from tkinter import filedialog
            
            file_path = filedialog.asksaveasfilename(
                title="导出插件配置",
                defaultextension=".json",
                filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
            )
            
            if file_path:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(config_data, f, indent=2, ensure_ascii=False)
                
                self.status_label.config(text=f"已导出插件配置: {os.path.basename(file_path)}")
        except Exception as e:
            messagebox.showerror("错误", f"导出配置失败: {e}")
    
    def import_plugin_config(self):
        """导入插件配置"""
        try:
            import json
            from tkinter import filedialog
            
            file_path = filedialog.askopenfilename(
                title="导入插件配置",
                filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
            )
            
            if file_path:
                with open(file_path, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                
                # 应用配置
                if "enabled_plugins" in config_data:
                    # 先禁用所有插件
                    all_plugins = self.plugin_manager.get_all_plugins()
                    for plugin_id in all_plugins:
                        self.plugin_manager.disable_plugin(plugin_id)
                    
                    # 启用指定的插件
                    for plugin_id in config_data["enabled_plugins"]:
                        self.plugin_manager.enable_plugin(plugin_id)
                
                self.refresh_plugin_list()
                self.status_label.config(text=f"已导入插件配置: {os.path.basename(file_path)}")
        except Exception as e:
            messagebox.showerror("错误", f"导入配置失败: {e}")
    
    def on_search_change(self, *args):
        """搜索框内容改变"""
        search_text = self.search_var.get().lower()
        
        # 隐藏所有项目
        for item in self.plugin_tree.get_children():
            self.plugin_tree.detach(item)
        
        # 显示匹配的项目
        for plugin_id, info in self.plugin_info_cache.items():
            plugin_name = info['name'].lower()
            plugin_desc = info.get('description', '').lower()
            
            if search_text in plugin_name or search_text in plugin_desc:
                plugin = self.plugin_manager.get_plugin(plugin_id)
                if plugin:
                    status_text = "✅ 启用" if plugin.enabled else "❌ 停用"
                    item = self.plugin_tree.insert("", "end", text=plugin.name,
                                                 values=(status_text, plugin.name, plugin.version, plugin.author))
    
    def view_plugin_code(self):
        """查看选中的插件的代码"""
        selection = self.plugin_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择一个插件")
            return
        
        item = selection[0]
        plugin_name = self.plugin_tree.item(item, "text")
        
        # 查找对应的插件
        plugin = None
        plugin_id = None
        for pid, info in self.plugin_info_cache.items():
            if info['name'] == plugin_name:
                plugin = self.plugin_manager.get_plugin(pid)
                plugin_id = pid
                break
        
        if plugin:
            if self.code_editor is None or not self.code_editor.window.winfo_exists():
                self.code_editor = CodeEditorView(self.root, self.plugin_manager, self.config_manager)
            
            self.code_editor.show_code_editor(plugin_id)
        else:
            messagebox.showwarning("警告", f"未找到插件: {plugin_name}")
    
    def create_new_plugin(self):
        """创建新的插件"""
        # 创建新建插件对话框
        dialog = tk.Toplevel(self.window)
        dialog.title("新建插件")
        dialog.geometry("500x400")
        dialog.transient(self.window)
        dialog.grab_set()
        dialog.resizable(False, False)
        
        # 居中显示对话框
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - (500 // 2)
        y = (dialog.winfo_screenheight() // 2) - (400 // 2)
        dialog.geometry(f"500x400+{x}+{y}")
        
        # 创建主框架
        main_frame = ttk.Frame(dialog)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # 标题
        title_label = ttk.Label(main_frame, text="新建插件", font=("Arial", 16, "bold"))
        title_label.pack(pady=(0, 20))
        
        # 表单框架
        form_frame = ttk.Frame(main_frame)
        form_frame.pack(fill=tk.BOTH, expand=True)
        
        # 插件名称
        ttk.Label(form_frame, text="插件名称 *:", font=("Arial", 10, "bold")).pack(anchor=tk.W, pady=(0, 5))
        name_var = tk.StringVar()
        name_entry = ttk.Entry(form_frame, textvariable=name_var, width=40, font=("Arial", 10))
        name_entry.pack(fill=tk.X, pady=(0, 15))
        name_entry.focus()
        
        # 插件ID（自动生成）
        ttk.Label(form_frame, text="插件ID (自动生成):", font=("Arial", 10, "bold")).pack(anchor=tk.W, pady=(0, 5))
        id_var = tk.StringVar()
        id_entry = ttk.Entry(form_frame, textvariable=id_var, width=40, font=("Arial", 10), state="readonly")
        id_entry.pack(fill=tk.X, pady=(0, 15))
        
        # 版本
        ttk.Label(form_frame, text="版本:", font=("Arial", 10, "bold")).pack(anchor=tk.W, pady=(0, 5))
        version_var = tk.StringVar(value="1.0.0")
        version_entry = ttk.Entry(form_frame, textvariable=version_var, width=40, font=("Arial", 10))
        version_entry.pack(fill=tk.X, pady=(0, 15))
        
        # 作者
        ttk.Label(form_frame, text="作者:", font=("Arial", 10, "bold")).pack(anchor=tk.W, pady=(0, 5))
        author_var = tk.StringVar(value="用户")
        author_entry = ttk.Entry(form_frame, textvariable=author_var, width=40, font=("Arial", 10))
        author_entry.pack(fill=tk.X, pady=(0, 15))
        
        # 描述
        ttk.Label(form_frame, text="描述:", font=("Arial", 10, "bold")).pack(anchor=tk.W, pady=(0, 5))
        desc_var = tk.StringVar()
        desc_text = tk.Text(form_frame, height=4, width=40, font=("Arial", 10))
        desc_text.pack(fill=tk.X, pady=(0, 15))
        
        # 更新ID的函数
        def update_id(*args):
            name = name_var.get()
            if name:
                plugin_id = name.lower().replace(' ', '_').replace('-', '_')
                id_var.set(plugin_id)
        
        name_var.trace("w", update_id)
        
        # 按钮框架
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X, pady=(20, 0))
        
        def create_plugin():
            """创建插件"""
            name = name_var.get().strip()
            version = version_var.get().strip()
            author = author_var.get().strip()
            description = desc_text.get(1.0, tk.END).strip()
            
            if not name:
                messagebox.showerror("错误", "请输入插件名称")
                return
            
            try:
                # 创建插件
                plugin_id = self.plugin_manager.create_new_plugin(name)
                
                # 如果创建成功，刷新列表并关闭对话框
                self.refresh_plugin_list()
                dialog.destroy()
                
                # 显示成功消息
                messagebox.showinfo("成功", f"插件 '{name}' 创建成功！\n\n插件ID: {plugin_id}\n文件位置: plugins/{plugin_id}_plugin.py")
                
                # 更新状态栏
                self.status_label.config(text=f"已创建插件: {name}")
                
            except Exception as e:
                messagebox.showerror("错误", f"创建插件失败: {e}")
        
        def cancel():
            """取消创建"""
            dialog.destroy()
        
        # 创建按钮
        ttk.Button(btn_frame, text="创建插件", command=create_plugin).pack(side=tk.RIGHT, padx=(5, 0))
        ttk.Button(btn_frame, text="取消", command=cancel).pack(side=tk.RIGHT)
        
        # 绑定回车键
        dialog.bind("<Return>", lambda e: create_plugin())
        dialog.bind("<Escape>", lambda e: cancel())
        
        # 初始更新ID
        update_id()
    
    def delete_selected_plugin(self):
        """删除选中的插件"""
        selection = self.plugin_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择一个插件")
            return
        
        item = selection[0]
        plugin_name = self.plugin_tree.item(item, "text")
        
        # 查找对应的插件ID
        plugin_id = None
        for pid, info in self.plugin_info_cache.items():
            if info['name'] == plugin_name:
                plugin_id = pid
                break
        
        if plugin_id:
            if messagebox.askyesno("确认删除", f"确定要删除插件 '{plugin_name}' 吗？这将删除其所有配置和文件。"):
                try:
                    self.plugin_manager.delete_plugin(plugin_id)
                    self.refresh_plugin_list()
                    self.status_label.config(text=f"已删除插件: {plugin_name}")
                except Exception as e:
                    messagebox.showerror("错误", f"删除插件失败: {e}")
        else:
            messagebox.showwarning("警告", f"未找到插件: {plugin_name}")
    
    def cleanup(self):
        """清理资源"""
        if self.window and self.window.winfo_exists():
            self.window.destroy()
        self.window = None 