# src/models/sprite_types.py - 精灵类型定义
from enum import Enum

class SpriteType(Enum):
    """精灵类型枚举"""
    SCENE = "scene"      # 场景素材类型
    MAP = "map"          # 地图类型
    H5_MAP = "h5_map"    # 凡人修仙H5地图类型

class ActionType(Enum):
    """动作类型枚举"""
    STAND = "stand"              # 站立
    RUN = "run"                  # 跑
    PREPARE_ATTACK = "prepare_attack"  # 准备攻击
    ATTACK = "attack"            # 攻击
    CAST = "cast"                # 施法
    DEATH = "death"              # 死亡
    RIDE_STAND = "ride_stand"    # 骑马站立
    RIDE_RUN = "ride_run"        # 骑马跑

class DirectionType(Enum):
    """方向类型枚举"""
    UP = 0          # 上
    UP_RIGHT = 1    # 右上
    RIGHT = 2       # 右
    DOWN_RIGHT = 3  # 右下
    DOWN = 4        # 下
    DOWN_LEFT = 5   # 左下
    LEFT = 6        # 左
    UP_LEFT = 7     # 左上

class CellType(Enum):
    """地图格子类型枚举"""
    WALKABLE = 0     # 可通行
    BLOCKED = 1      # 不可通行
    SPECIAL = 2      # 特殊
    MASKED = 3       # 遮罩区域