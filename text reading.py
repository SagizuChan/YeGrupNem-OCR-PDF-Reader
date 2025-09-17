import pytesseract
from PIL import Image
import tkinter as tk
from tkinter import filedialog
import ttkbootstrap as tb
from ttkbootstrap import Style
import win32api
import pyperclip
import threading

text_to_copy = ""  # prevent NameError

def upload_action():
    global text_to_copy
    try:
        filename = filedialog.askopenfilename()
        if not filename:
            return

        image = Image.open(filename)
        text = pytesseract.image_to_string(image)

        if text.strip() == '':
            win32api.MessageBox(0, 'No text was found in the image', 'Error')
        else:
            text_to_copy = text
            text_box.delete(1.0, tk.END)
            text_box.insert(tk.END, text)
    except pytesseract.pytesseract.TesseractNotFoundError:
        win32api.MessageBox(0, 'Tesseract is not installed or not found.', 'Error')
    except Exception as e:
        win32api.MessageBox(0, f'Unexpected Error: {e}', 'Error')

def copy():
    try:
        global text_to_copy
        if not text_to_copy.strip():
            raise ValueError("No text available")
        pyperclip.copy(text_to_copy)
    except Exception as e:
        win32api.MessageBox(0, f'Error: {e}', 'Error')

def close():
    root.destroy()

root = Style(theme='vapor').master
root.resizable(False, False)
root.title("Image to Text Converter")

# Center window
screen_width = root.winfo_screenwidth()
screen_height = root.winfo_screenheight()
window_width = 800
window_height = 625
x = (screen_width - window_width) // 2
y = (screen_height - window_height) // 2
root.geometry(f"{window_width}x{window_height}+{x}+{y}")

header = tk.Label(root, text="Text Converter", font=("Fixedsys", 30))
header.pack()

text_box = tk.Text(root, height=30, width=125)
text_box.pack(padx=2, pady=2)

button_frame = tk.Frame(root)
button_frame.pack(pady=10)

cpy = tk.Button(button_frame, text='Copy', command=copy, width=10, height=2)
cpy.pack(side=tk.LEFT, padx=10)

open_btn = tk.Button(button_frame, text='Open', command=lambda: threading.Thread(target=upload_action).start(), width=20, height=2)
open_btn.pack(side=tk.LEFT, padx=10)

close_btn = tk.Button(button_frame, text='Exit', command=close, width=10, height=2)
close_btn.pack(side=tk.LEFT, padx=10)

root.mainloop()
