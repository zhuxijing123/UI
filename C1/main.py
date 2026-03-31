# main.py - 主入口文件
import tkinter as tk
from src.app import SpriteViewerApp

def main():
    root = tk.Tk()
    app = SpriteViewerApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()