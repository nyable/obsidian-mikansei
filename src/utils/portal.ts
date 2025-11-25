/**
 * Svelte action to portal an element to a target node (default: document.body)
 */
export function portal(node: HTMLElement, target: HTMLElement | string = document.body) {
    let targetNode: HTMLElement | null;

    if (typeof target === 'string') {
        targetNode = document.querySelector(target);
    } else {
        targetNode = target;
    }

    if (!targetNode) return;

    targetNode.appendChild(node);

    return {
        destroy() {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
    };
}
