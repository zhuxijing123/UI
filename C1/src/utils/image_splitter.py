"""
Image Splitter Utility
---------------------
提供一个简单的接口，用于根据 JSON 配置将一张包含多帧的大图拆分为独立的小图。

目前支持的 JSON 结构示例（与素材 chat.json 相同）：
{
    "file": "chat.png",
    "frames": {
        "frame_name": {
            "x": 10,
            "y": 20,
            "w": 30,
            "h": 40,
            "offX": 0,
            "offY": 0,
            "sourceW": 30,
            "sourceH": 40
        },
        ...
    }
}
拆分后的小图将保存到原 JSON 所在目录下的 "拆图" 子目录中（如不存在则自动创建）。
"""
import os
import json
from typing import Dict
from PIL import Image


class ImageSplitter:
    """根据 JSON 描述将大图拆分为多个小图。"""

    @staticmethod
    def split(json_path: str, output_subdir: str = "拆图") -> Dict[str, str]:
        """执行拆图操作。

        参数
        ----
        json_path: str
            JSON 文件路径。
        output_subdir: str, optional
            输出子目录名称。默认为 "拆图"。

        返回
        ----
        Dict[str, str]
            键为帧名，值为生成的小图路径。
        """
        if not os.path.isfile(json_path):
            raise FileNotFoundError(f"JSON 文件不存在: {json_path}")

        # 读取 JSON
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "file" not in data or "frames" not in data:
            raise ValueError("JSON 格式不正确，缺少 'file' 或 'frames' 字段")

        image_filename = data["file"]
        frames = data["frames"]
        base_dir = os.path.dirname(json_path)
        image_path = os.path.join(base_dir, image_filename)

        if not os.path.isfile(image_path):
            raise FileNotFoundError(f"图片文件不存在: {image_path}")

        # 打开大图
        big_image = Image.open(image_path).convert("RGBA")

        # 输出目录
        output_dir = os.path.join(base_dir, output_subdir)
        os.makedirs(output_dir, exist_ok=True)

        saved_paths: Dict[str, str] = {}

        for frame_name, frame_info in frames.items():
            try:
                x = frame_info.get("x", 0)
                y = frame_info.get("y", 0)
                w = frame_info.get("w", frame_info.get("width", 0))
                h = frame_info.get("h", frame_info.get("height", 0))

                # 裁剪
                crop_box = (x, y, x + w, y + h)
                frame_img = big_image.crop(crop_box)

                # 保存
                output_path = os.path.join(output_dir, f"{frame_name}.png")
                frame_img.save(output_path)
                saved_paths[frame_name] = output_path
            except Exception as e:
                # 继续处理其他帧
                print(f"[ImageSplitter] 拆分帧 '{frame_name}' 失败: {e}")

        return saved_paths
