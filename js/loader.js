/**
 * viewLoader.js
 *
 * Handles switching application views by loading HTML fragments
 * into the main application container.
 */

/**
 * Switches the application view.
 * @param {string} filePath 
 * @param {HTMLElement} element 
 * @param {Function} callback 
 * @returns {void}
 */
export async function switchApplicationView(filePath, element, callback = null) {
  if (!element) return;

  element.innerHTML = "";

  try {
    const res = await fetch(filePath);

    if (!res.ok) {
      throw new Error(`Could not load ${filePath}: ${res.statusText}`);
    }

    const htmlCode = await res.text();
    element.innerHTML = htmlCode;

    if (callback) callback();

  } catch (error) {
    console.error(error);
  }
}