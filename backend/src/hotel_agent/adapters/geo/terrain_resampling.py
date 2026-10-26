from typing import cast

import numpy as np


def enlarge_window(heights: np.ndarray, cell_x: int, cell_y: int, scale: int) -> np.ndarray:
    height, width = heights.shape
    axis = (np.arange(256, dtype=np.float32) + 0.5) / 256
    x = np.clip((axis + cell_x) * width / scale - 0.5, 0, width - 1)
    y = np.clip((axis + cell_y) * height / scale - 0.5, 0, height - 1)
    left, top = np.floor(x).astype(int), np.floor(y).astype(int)
    right, bottom = np.minimum(left + 1, width - 1), np.minimum(top + 1, height - 1)
    dx, dy = x - left, y - top
    upper = heights[top[:, None], left] * (1 - dx) + heights[top[:, None], right] * dx
    lower = heights[bottom[:, None], left] * (1 - dx) + heights[bottom[:, None], right] * dx
    return cast(np.ndarray, ((1 - dy[:, None]) * upper + dy[:, None] * lower).astype(np.float32))
