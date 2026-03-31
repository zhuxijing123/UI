# src/utils/plugin_manager.py - 插件管理系统
import os
import sys
import importlib
import importlib.util
from typing import Dict, List, Any, Optional, Callable
from abc import ABC, abstractmethod
import json
import threading
import re # Added for _generate_plugin_id


class PluginBase(ABC):
    """插件基类"""
    
    def __init__(self, plugin_manager, config_manager):
        self.plugin_manager = plugin_manager
        self.config_manager = config_manager
        self.name = "Unknown Plugin"
        self.version = "1.0.0"
        self.description = "A plugin"
        self.author = "Unknown"
        self.enabled = False
        self.plugin_id = None  # 插件唯一标识符
    
    @abstractmethod
    def initialize(self) -> bool:
        """初始化插件"""
        pass
    
    @abstractmethod
    def execute(self, *args, **kwargs) -> Any:
        """执行插件功能"""
        pass
    
    def cleanup(self):
        """清理插件资源"""
        pass
    
    def get_info(self) -> Dict[str, Any]:
        """获取插件信息"""
        return {
            'id': self.plugin_id,
            'name': self.name,
            'version': self.version,
            'description': self.description,
            'author': self.author,
            'enabled': self.enabled
        }
    
    def set_enabled(self, enabled: bool):
        """设置插件启用状态"""
        if self.enabled != enabled:
            self.enabled = enabled
            # 注意：这个方法不应该直接调用配置管理器，避免循环调用
            # 配置保存应该在插件管理器的enable_plugin/disable_plugin方法中处理


class PluginManager:
    """插件管理器"""
    
    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.plugins: Dict[str, PluginBase] = {}
        self.plugin_hooks: Dict[str, List[Callable]] = {}
        self.plugin_directory = config_manager.get('plugins.plugin_directory', 'plugins')
        self.auto_load_plugins = config_manager.get('plugins.auto_load_plugins', True)
        
        # 确保插件目录存在
        if not os.path.exists(self.plugin_directory):
            os.makedirs(self.plugin_directory)
        
        # 创建插件目录的__init__.py文件
        init_file = os.path.join(self.plugin_directory, '__init__.py')
        if not os.path.exists(init_file):
            with open(init_file, 'w') as f:
                f.write('# Plugin directory\n')
        
        if self.auto_load_plugins:
            self.load_all_plugins()
    
    def load_plugin(self, plugin_path: str) -> Optional[PluginBase]:
        """加载单个插件"""
        try:
            # 获取插件文件名（不含扩展名）
            plugin_name = os.path.splitext(os.path.basename(plugin_path))[0]
            
            # 加载插件模块
            spec = importlib.util.spec_from_file_location(plugin_name, plugin_path)
            if spec is None or spec.loader is None:
                print(f"无法加载插件: {plugin_path}")
                return None
            
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # 查找插件类
            plugin_class = None
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (isinstance(attr, type) and 
                    issubclass(attr, PluginBase) and 
                    attr != PluginBase):
                    plugin_class = attr
                    break
            
            # 如果没找到，尝试查找以Plugin结尾的类
            if plugin_class is None:
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (isinstance(attr, type) and 
                        attr_name.endswith('Plugin') and
                        hasattr(attr, 'initialize') and
                        hasattr(attr, 'execute')):
                        plugin_class = attr
                        break
            
            if plugin_class is None:
                print(f"在 {plugin_path} 中未找到插件类")
                return None
            
            # 创建插件实例
            plugin = plugin_class(self, self.config_manager)
            
            # 设置插件ID
            if not plugin.plugin_id:
                plugin.plugin_id = plugin.name
            
            # 检查插件是否应该启用（从配置中读取）
            enabled_plugins = self.config_manager.get_enabled_plugins()
            should_enable = plugin.plugin_id in enabled_plugins
            
            # 初始化插件
            if plugin.initialize():
                self.plugins[plugin.plugin_id] = plugin
                plugin.set_enabled(should_enable)
                print(f"插件加载成功: {plugin.name} (启用状态: {should_enable})")
                return plugin
            else:
                print(f"插件初始化失败: {plugin.name}")
                return None
                
        except Exception as e:
            print(f"加载插件失败 {plugin_path}: {e}")
            return None
    
    def load_all_plugins(self):
        """加载所有插件"""
        if not os.path.exists(self.plugin_directory):
            return
        
        for filename in os.listdir(self.plugin_directory):
            if filename.endswith('.py') and not filename.startswith('__'):
                plugin_path = os.path.join(self.plugin_directory, filename)
                self.load_plugin(plugin_path)
    
    def unload_plugin(self, plugin_id: str) -> bool:
        """卸载插件"""
        if plugin_id in self.plugins:
            plugin = self.plugins[plugin_id]
            plugin.cleanup()
            plugin.set_enabled(False)
            del self.plugins[plugin_id]
            print(f"插件卸载成功: {plugin_id}")
            return True
        return False
    
    def get_plugin(self, plugin_id: str) -> Optional[PluginBase]:
        """获取插件"""
        return self.plugins.get(plugin_id)
    
    def get_all_plugins(self) -> Dict[str, PluginBase]:
        """获取所有插件"""
        return self.plugins.copy()
    
    def get_enabled_plugins(self) -> Dict[str, PluginBase]:
        """获取启用的插件"""
        return {plugin_id: plugin for plugin_id, plugin in self.plugins.items() if plugin.enabled}
    
    def enable_plugin(self, plugin_id: str) -> bool:
        """启用插件"""
        if plugin_id in self.plugins:
            plugin = self.plugins[plugin_id]
            if not plugin.enabled:
                plugin.enabled = True
                # 直接保存到配置，避免循环调用
                self.config_manager.add_enabled_plugin(plugin_id)
                print(f"插件已启用: {plugin_id}")
            return True
        return False
    
    def disable_plugin(self, plugin_id: str) -> bool:
        """禁用插件"""
        if plugin_id in self.plugins:
            plugin = self.plugins[plugin_id]
            if plugin.enabled:
                plugin.enabled = False
                # 直接保存到配置，避免循环调用
                self.config_manager.remove_enabled_plugin(plugin_id)
                print(f"插件已禁用: {plugin_id}")
            return True
        return False
    
    def execute_plugin(self, plugin_id: str, *args, **kwargs) -> Any:
        """执行插件"""
        plugin = self.get_plugin(plugin_id)
        if plugin and plugin.enabled:
            try:
                return plugin.execute(*args, **kwargs)
            except Exception as e:
                print(f"执行插件失败 {plugin_id}: {e}")
                return None
        return None
    
    def register_hook(self, hook_name: str, callback: Callable):
        """注册钩子函数"""
        if hook_name not in self.plugin_hooks:
            self.plugin_hooks[hook_name] = []
        self.plugin_hooks[hook_name].append(callback)
    
    def unregister_hook(self, hook_name: str, callback: Callable):
        """注销钩子函数"""
        if hook_name in self.plugin_hooks and callback in self.plugin_hooks[hook_name]:
            self.plugin_hooks[hook_name].remove(callback)
    
    def trigger_hook(self, hook_name: str, *args, **kwargs) -> List[Any]:
        """触发钩子函数"""
        results = []
        if hook_name in self.plugin_hooks:
            for callback in self.plugin_hooks[hook_name]:
                try:
                    result = callback(*args, **kwargs)
                    results.append(result)
                except Exception as e:
                    print(f"钩子函数执行失败 {hook_name}: {e}")
        return results
    
    def get_plugin_info(self) -> List[Dict[str, Any]]:
        """获取所有插件信息"""
        info_list = []
        for plugin in self.plugins.values():
            info_list.append(plugin.get_info())
        return info_list
    
    def reload_plugin(self, plugin_id: str) -> bool:
        """重新加载插件"""
        if plugin_id in self.plugins:
            # 先卸载
            self.unload_plugin(plugin_id)
        
        # 查找插件文件
        plugin_file = None
        for filename in os.listdir(self.plugin_directory):
            if filename.endswith('.py') and not filename.startswith('__'):
                if filename.startswith(plugin_id):
                    plugin_file = os.path.join(self.plugin_directory, filename)
                    break
        
        if plugin_file:
            # 重新加载
            return self.load_plugin(plugin_file) is not None
        return False
    
    def cleanup(self):
        """清理所有插件"""
        for plugin_id in list(self.plugins.keys()):
            self.unload_plugin(plugin_id)
    
    def get_plugin_directory(self) -> str:
        """获取插件目录"""
        return self.plugin_directory
    
    def set_plugin_directory(self, directory: str):
        """设置插件目录"""
        self.plugin_directory = directory
        self.config_manager.set('plugins.plugin_directory', directory)
    
    def delete_plugin(self, plugin_id: str) -> bool:
        """删除插件"""
        try:
            # 检查插件是否存在
            if plugin_id not in self.plugins:
                raise ValueError(f"插件 '{plugin_id}' 不存在")
            
            plugin = self.plugins[plugin_id]
            
            # 先停用插件
            if plugin.enabled:
                self.disable_plugin(plugin_id)
            
            # 清理插件资源
            plugin.cleanup()
            
            # 从插件列表中移除
            del self.plugins[plugin_id]
            
            # 删除插件文件
            plugin_filename = f"{plugin_id}_plugin.py"
            plugin_filepath = os.path.join(self.plugin_directory, plugin_filename)
            
            if os.path.exists(plugin_filepath):
                os.remove(plugin_filepath)
                print(f"已删除插件文件: {plugin_filepath}")
            
            # 删除插件配置
            self.config_manager.remove(f'plugins.{plugin_id}')
            
            # 从启用的插件列表中移除
            enabled_plugins = self.config_manager.get('enabled_plugins', [])
            if plugin_id in enabled_plugins:
                enabled_plugins.remove(plugin_id)
                self.config_manager.set('enabled_plugins', enabled_plugins)
            
            print(f"插件删除成功: {plugin_id}")
            return True
            
        except Exception as e:
            print(f"删除插件失败: {e}")
            raise
    
    def create_new_plugin(self, plugin_name: str) -> str:
        """创建新的插件"""
        try:
            # 生成插件ID（使用小写和下划线，中文转换为拼音）
            plugin_id = self._generate_plugin_id(plugin_name)
            
            # 检查插件ID是否已存在
            if plugin_id in self.plugins:
                raise ValueError(f"插件ID '{plugin_id}' 已存在")
            
            # 创建插件文件名
            plugin_filename = f"{plugin_id}_plugin.py"
            plugin_filepath = os.path.join(self.plugin_directory, plugin_filename)
            
            # 检查文件是否已存在
            if os.path.exists(plugin_filepath):
                raise ValueError(f"插件文件 '{plugin_filename}' 已存在")
            
            # 生成插件代码模板
            plugin_code = self._generate_plugin_template(plugin_name, plugin_id)
            
            # 写入插件文件
            with open(plugin_filepath, 'w', encoding='utf-8') as f:
                f.write(plugin_code)
            
            # 加载新创建的插件
            new_plugin = self.load_plugin(plugin_filepath)
            if new_plugin:
                # 设置插件ID
                new_plugin.plugin_id = plugin_id
                self.plugins[plugin_id] = new_plugin
                print(f"插件创建成功: {plugin_name} (ID: {plugin_id})")
                return plugin_id
            else:
                raise ValueError("插件加载失败")
                
        except Exception as e:
            print(f"创建插件失败: {e}")
            raise
    
    def _generate_plugin_id(self, plugin_name: str) -> str:
        """生成插件ID，将中文转换为拼音或英文"""
        # 简单的中文到拼音映射（常用字符）
        chinese_to_pinyin = {
            '图片': 'image', '编辑器': 'editor', '处理器': 'processor', '管理': 'manager',
            '工具': 'tool', '设置': 'settings', '配置': 'config', '数据': 'data',
            '文件': 'file', '系统': 'system', '用户': 'user', '插件': 'plugin',
            '功能': 'function', '应用': 'app', '程序': 'program', '软件': 'software',
            '测试': 'test', '开发': 'dev', '调试': 'debug', '优化': 'optimize',
            '分析': 'analyze', '转换': 'convert', '处理': 'process', '生成': 'generate',
            '导入': 'import', '导出': 'export', '备份': 'backup', '恢复': 'restore',
            '新建': 'new', '打开': 'open', '保存': 'save', '关闭': 'close',
            '复制': 'copy', '粘贴': 'paste', '剪切': 'cut', '删除': 'delete',
            '查找': 'find', '替换': 'replace', '撤销': 'undo', '重做': 'redo'
        }
        
        # 将中文转换为拼音
        result = plugin_name
        for chinese, pinyin in chinese_to_pinyin.items():
            result = result.replace(chinese, pinyin)
        
        # 处理剩余的中文字符（转换为拼音首字母）
        # 移除所有中文字符，保留英文、数字和下划线
        result = re.sub(r'[\u4e00-\u9fff]', '', result)
        
        # 转换为小写，替换空格和特殊字符为下划线
        result = result.lower().replace(' ', '_').replace('-', '_').replace('_', '_')
        
        # 移除多余的下划线
        result = re.sub(r'_+', '_', result)
        result = result.strip('_')
        
        # 如果结果为空，使用默认名称
        if not result:
            result = 'custom_plugin'
        
        return result
    
    def _generate_plugin_template(self, plugin_name: str, plugin_id: str) -> str:
        """生成插件代码模板"""
        template = f'''# plugins/{plugin_id}_plugin.py - {plugin_name}插件
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import os
import sys
from typing import Dict, List, Any, Optional

# 添加src目录到路径，以便导入插件基类
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
from utils.plugin_manager import PluginBase


class {plugin_name.replace(' ', '')}Plugin(PluginBase):
    """{plugin_name}插件 - 请在此描述插件功能"""
    
    def __init__(self, plugin_manager, config_manager):
        super().__init__(plugin_manager, config_manager)
        self.plugin_id = "{plugin_id}"
        self.name = "{plugin_name}"
        self.version = "1.0.0"
        self.description = "{plugin_name}插件 - 请在此描述插件功能"
        self.author = "用户"
        
        # 插件窗口
        self.window = None
        
        # 插件数据
        self.data = {{}}
        
        # 插件配置
        self.config = self.config_manager.get(f'plugins.{{self.plugin_id}}', {{}})
    
    def initialize(self) -> bool:
        """初始化插件"""
        try:
            print(f"初始化{{self.name}}插件: {{self.name}}")
            
            # 在这里添加初始化代码
            # 例如：加载配置、初始化数据等
            
            return True
        except Exception as e:
            print(f"{{self.name}}插件初始化失败: {{e}}")
            return False
    
    def execute(self, *args, **kwargs) -> Any:
        """执行插件功能"""
        try:
            # 在这里实现插件的主要功能
            self.show_plugin_window()
            return True
        except Exception as e:
            print(f"执行{{self.name}}插件失败: {{e}}")
            return False
    
    def show_plugin_window(self):
        """显示插件窗口"""
        if self.window is None or not self.window.winfo_exists():
            self.create_plugin_window()
        else:
            self.window.deiconify()
            self.window.lift()
    
    def create_plugin_window(self):
        """创建插件窗口"""
        self.window = tk.Toplevel()
        self.window.title(f"{{self.name}} - {{self.name}}")
        self.window.geometry("800x600")
        self.window.protocol("WM_DELETE_WINDOW", self.window.withdraw)
        
        # 创建主框架
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 创建菜单栏
        self.create_menu(main_frame)
        
        # 创建工具栏
        self.create_toolbar(main_frame)
        
        # 创建主内容区域
        self.create_content_area(main_frame)
        
        # 创建状态栏
        self.create_status_bar(main_frame)
    
    def create_menu(self, parent):
        """创建菜单栏"""
        menubar = tk.Menu(self.window)
        self.window.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="新建", command=self.new_project)
        file_menu.add_command(label="打开", command=self.open_file)
        file_menu.add_separator()
        file_menu.add_command(label="保存", command=self.save_file)
        file_menu.add_command(label="另存为", command=self.save_as_file)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.window.withdraw)
        
        # 编辑菜单
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="编辑", menu=edit_menu)
        edit_menu.add_command(label="撤销", command=self.undo)
        edit_menu.add_command(label="重做", command=self.redo)
        edit_menu.add_separator()
        edit_menu.add_command(label="剪切", command=self.cut)
        edit_menu.add_command(label="复制", command=self.copy)
        edit_menu.add_command(label="粘贴", command=self.paste)
        
        # 工具菜单
        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="工具", menu=tools_menu)
        tools_menu.add_command(label="设置", command=self.show_settings)
        tools_menu.add_command(label="关于", command=self.show_about)
    
    def create_toolbar(self, parent):
        """创建工具栏"""
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        # 文件操作按钮
        file_frame = ttk.LabelFrame(toolbar, text="文件操作")
        file_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(file_frame, text="新建", command=self.new_project).pack(side=tk.LEFT, padx=2)
        ttk.Button(file_frame, text="打开", command=self.open_file).pack(side=tk.LEFT, padx=2)
        ttk.Button(file_frame, text="保存", command=self.save_file).pack(side=tk.LEFT, padx=2)
        
        # 工具按钮
        tools_frame = ttk.LabelFrame(toolbar, text="工具")
        tools_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(tools_frame, text="设置", command=self.show_settings).pack(side=tk.LEFT, padx=2)
        ttk.Button(tools_frame, text="关于", command=self.show_about).pack(side=tk.LEFT, padx=2)
    
    def create_content_area(self, parent):
        """创建主内容区域"""
        content_frame = ttk.Frame(parent)
        content_frame.pack(fill=tk.BOTH, expand=True)
        
        # 左侧面板
        left_frame = ttk.Frame(content_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 5))
        
        # 添加一些示例控件
        ttk.Label(left_frame, text="功能面板", font=("Arial", 12, "bold")).pack(pady=5)
        
        # 示例按钮
        ttk.Button(left_frame, text="示例功能1", 
                  command=lambda: messagebox.showinfo("提示", "这是示例功能1")).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(left_frame, text="示例功能2", 
                  command=lambda: messagebox.showinfo("提示", "这是示例功能2")).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(left_frame, text="示例功能3", 
                  command=lambda: messagebox.showinfo("提示", "这是示例功能3")).pack(fill=tk.X, padx=5, pady=2)
        
        # 右侧主内容区域
        right_frame = ttk.Frame(content_frame)
        right_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # 欢迎信息
        welcome_frame = ttk.LabelFrame(right_frame, text="欢迎使用")
        welcome_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        welcome_text = f"""
欢迎使用{{self.name}}插件！

这是一个新创建的插件模板，您可以：

1. 修改插件代码以实现您的功能
2. 添加新的菜单项和工具栏按钮
3. 实现数据处理和文件操作
4. 添加用户界面控件
5. 集成其他库和功能

插件文件位置：plugins/{plugin_id}_plugin.py

开始开发您的插件吧！
"""
        
        text_widget = tk.Text(welcome_frame, wrap=tk.WORD, font=("Arial", 10))
        text_widget.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        text_widget.insert(tk.END, welcome_text)
        text_widget.config(state=tk.DISABLED)
    
    def create_status_bar(self, parent):
        """创建状态栏"""
        status_frame = ttk.Frame(parent)
        status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.status_label = ttk.Label(status_frame, text="插件已就绪")
        self.status_label.pack(side=tk.LEFT, padx=5)
        
        # 版本信息
        version_label = ttk.Label(status_frame, text=f"版本: {{self.version}}")
        version_label.pack(side=tk.RIGHT, padx=5)
    
    # 示例方法
    def new_project(self):
        """新建项目"""
        messagebox.showinfo("新建项目", "新建项目功能")
    
    def open_file(self):
        """打开文件"""
        file_path = filedialog.askopenfilename(
            title="打开文件",
            filetypes=[("所有文件", "*.*")]
        )
        if file_path:
            messagebox.showinfo("打开文件", f"已选择文件: {{file_path}}")
    
    def save_file(self):
        """保存文件"""
        messagebox.showinfo("保存文件", "保存文件功能")
    
    def save_as_file(self):
        """另存为"""
        file_path = filedialog.asksaveasfilename(
            title="另存为",
            defaultextension=".txt"
        )
        if file_path:
            messagebox.showinfo("另存为", f"已保存到: {{file_path}}")
    
    def undo(self):
        """撤销"""
        messagebox.showinfo("撤销", "撤销功能")
    
    def redo(self):
        """重做"""
        messagebox.showinfo("重做", "重做功能")
    
    def cut(self):
        """剪切"""
        messagebox.showinfo("剪切", "剪切功能")
    
    def copy(self):
        """复制"""
        messagebox.showinfo("复制", "复制功能")
    
    def paste(self):
        """粘贴"""
        messagebox.showinfo("粘贴", "粘贴功能")
    
    def show_settings(self):
        """显示设置"""
        messagebox.showinfo("设置", "插件设置功能")
    
    def show_about(self):
        """显示关于"""
        about_text = f"""
{{self.name}}插件

版本: {{self.version}}
作者: {{self.author}}
描述: {{self.description}}

这是一个示例插件，您可以在此基础上开发您的功能。
"""
        messagebox.showinfo("关于", about_text)
    
    def cleanup(self):
        """清理插件资源"""
        if self.window and self.window.winfo_exists():
            self.window.destroy()
        self.window = None
        print(f"{{self.name}}插件已清理: {{self.name}}")
'''
        return template 