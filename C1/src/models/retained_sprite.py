# src/models/retained_sprite.py - 保留素材管理器
from typing import Dict, List, Optional
from .sprite_types import SpriteType, ActionType, DirectionType
from .sprite_data import SpriteData


class RetainedSprite:
    """保留的素材数据"""
    
    def __init__(self, sprite_type: str, sprite_id: str, action: Optional[str], 
                 sprite_data: SpriteData, name: str = None):
        self.sprite_type = sprite_type
        self.sprite_id = sprite_id
        self.action = action
        self.sprite_data = sprite_data
        self.name = name or f"{sprite_type}_{sprite_id}"
        self.visible = True
        self.sync_animation = True
        self.sync_direction = True
        self.sync_action = True


class RetainedSpriteManager:
    """保留素材管理器"""
    
    def __init__(self, logger):
        self.logger = logger
        self.retained_sprites: Dict[str, RetainedSprite] = {}
        
    def add_retained_sprite(self, sprite_type: str, sprite_id: str, 
                           action: Optional[str], sprite_data: SpriteData, 
                           name: str = None) -> str:
        """添加保留素材"""
        key = f"{sprite_type}_{sprite_id}_{action.value if action else 'none'}"
        
        if key in self.retained_sprites:
            self.logger.log(f"素材已存在: {key}", "WARN")
            return key
            
        retained_sprite = RetainedSprite(sprite_type, sprite_id, action, sprite_data, name)
        self.retained_sprites[key] = retained_sprite
        self.logger.log(f"添加保留素材: {key} -> {retained_sprite.name}", "INFO")
        return key
    
    def remove_retained_sprite(self, key: str) -> bool:
        """移除保留素材"""
        if key in self.retained_sprites:
            name = self.retained_sprites[key].name
            del self.retained_sprites[key]
            self.logger.log(f"移除保留素材: {key} -> {name}", "INFO")
            return True
        return False
    
    def clear_all_retained_sprites(self):
        """清除所有保留素材"""
        count = len(self.retained_sprites)
        self.retained_sprites.clear()
        self.logger.log(f"清除所有保留素材: {count} 个", "INFO")
    
    def get_retained_sprite(self, key: str) -> Optional[RetainedSprite]:
        """获取保留素材"""
        return self.retained_sprites.get(key)
    
    def get_all_retained_sprites(self) -> List[RetainedSprite]:
        """获取所有保留素材"""
        return list(self.retained_sprites.values())
    
    def get_visible_retained_sprites(self) -> List[RetainedSprite]:
        """获取所有可见的保留素材"""
        return [sprite for sprite in self.retained_sprites.values() if sprite.visible]
    
    def toggle_sprite_visibility(self, key: str) -> bool:
        """切换素材可见性"""
        if key in self.retained_sprites:
            sprite = self.retained_sprites[key]
            sprite.visible = not sprite.visible
            self.logger.log(f"切换素材可见性: {key} -> {'可见' if sprite.visible else '隐藏'}", "INFO")
            return True
        return False
    
    def sync_all_sprites(self, current_direction: str, current_action: str, 
                        is_playing: bool, current_frame: int):
        """同步所有保留素材的状态"""
        for sprite in self.retained_sprites.values():
            if not sprite.visible:
                continue
                
            if sprite.sync_direction:
                sprite.sprite_data.set_direction(current_direction)
            
            if sprite.sync_action and sprite.action != current_action:
                # 这里需要重新加载素材，暂时跳过
                pass
                
            if sprite.sync_animation and is_playing:
                sprite.sprite_data.set_frame(current_frame)
    
    def get_sprite_preview_info(self, key: str) -> Optional[dict]:
        """获取素材预览信息"""
        if key in self.retained_sprites:
            sprite = self.retained_sprites[key]
            current_frame = sprite.sprite_data.get_current_frame()
            if current_frame:
                return {
                    "name": sprite.name,
                    "type": sprite.sprite_type,
                    "id": sprite.sprite_id,
                    "action": sprite.action.value if sprite.action else "none",
                    "size": current_frame.image.size,
                    "offset": (current_frame.offset_x, current_frame.offset_y),
                    "visible": sprite.visible
                }
        return None 