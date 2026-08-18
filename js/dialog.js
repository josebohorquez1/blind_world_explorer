let dialogElement = null;

/**
 * Loads the dialog element
 * If the element already exists, it is simply returned
 * Otherwise, a new dialog element is created
 * 
 * @returns {Promise<HTMLDialogElement>} The loaded dialog element.
 */
async function loadDialog() {
    if (dialogElement) return dialogElement;
    const mount = document.getElementById("app-mount");
    if (!mount) {
        throw new Error("Mount element not found.");
    }
    const response = await fetch("pages/dialog.html");
    if (!response.ok) {
        throw new Error("Unable to find dialog html.");
    }
    const html = await response.text();
    mount.insertAdjacentHTML("beforeend", html);
    dialogElement = document.getElementById("app-dialog");
    return dialogElement;
}

/**
 * Displays an accessible dialog.
 *
 * The dialog can function as either an informational message
 * dialog or a confirmation dialog.
 *
 * When isConfirmation is true, both the OK and Cancel buttons
 * are displayed. Otherwise, only the OK button is shown.
 *
 * @param {string} title - The dialog title.
 * @param {string} message - The dialog message.
 * @param {boolean} isConfirmation - Whether the dialog should
 * include a Cancel button.
 *
 * @returns {Promise<boolean>} Resolves to true when the user
 * selects OK and false when the user selects Cancel.
 */
export async function showDialog(title, message, isConfirmation = false) {
    const dialog = await loadDialog();
    const titleElement =
    document.getElementById("app-dialog-title");
    const messageElement =
    document.getElementById("app-dialog-message");
    const okButton =
    document.getElementById("app-dialog-ok");
    const cancelButton =
    document.getElementById("app-dialog-cancel");
    titleElement.textContent = title;
    messageElement.textContent = message;
    cancelButton.hidden = !isConfirmation;
    return new Promise((resolve) => {
        const cleanup = () => {
            okButton.removeEventListener("click", handleOk);
            cancelButton.removeEventListener("click", handleCancel);
            dialog.removeEventListener("cancel", handleDismiss);
        };
        const handleOk = () => {
            cleanup();
            dialog.close();
            resolve(true);
        };
        const handleCancel = () => {
            cleanup();
            dialog.close();
            resolve(false);
        };
        const handleDismiss = () => {
            cleanup();
            dialog.close();
            resolve(false);
        }
        okButton.addEventListener("click", handleOk);
        cancelButton.addEventListener("click", handleCancel);
        dialog.addEventListener("cancel", handleDismiss);
        if (dialog.open) dialog.close();
        dialog.showModal();
        okButton.focus();
    })
}
