export const initDetailsModal = () => {

    const modalEl = document.getElementById("detailsModal");
    if (!modalEl) return;

    modalEl.addEventListener("hidden.bs.modal", () => {

        const menu = document.getElementById("menu");
        const menuButton = document.getElementById("btn-menu");

        if (menu) menu.hidden = true;

        if (menuButton) {
            menuButton.setAttribute("aria-expanded", "false");
        }
        menuButton.focus();
    });

};
