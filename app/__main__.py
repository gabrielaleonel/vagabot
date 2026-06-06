from app.gui import App


def main():
    app = App()
    app.protocol("WM_DELETE_WINDOW", app.fechar)
    app.mainloop()


if __name__ == "__main__":
    main()
