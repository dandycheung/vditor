import DiffMatchPatch, {diff_match_patch, patch_obj} from "diff-match-patch";
import {disableToolbar} from "../toolbar/disableToolbar";
import {enableToolbar} from "../toolbar/enableToolbar";
import {scrollCenter} from "../util/editorCommenEvent";
import {addP2Li} from "../wysiwyg/addP2Li";
import {afterRenderEvent} from "../wysiwyg/afterRenderEvent";
import {highlightToolbar} from "../wysiwyg/highlightToolbar";
import {processCodeRender} from "../wysiwyg/processCodeRender";
import {setRangeByWbr} from "../wysiwyg/setRangeByWbr";

class WysiwygUndo {
    private undoStack: patch_obj[][];
    private redoStack: patch_obj[][];
    private stackSize = 50;
    private dmp: diff_match_patch;
    private lastText: string;
    private hasUndo: boolean;

    constructor() {
        this.redoStack = [];
        this.undoStack = [];
        // @ts-ignore
        this.dmp = new DiffMatchPatch();
        this.lastText = "";
        this.hasUndo = false;
    }

    public undo(vditor: IVditor) {
        if (this.undoStack.length < 2) {
            return;
        }
        const state = this.undoStack.pop();
        if (!state || !state) {
            return;
        }
        this.redoStack.push(state);
        this.renderDiff(state, vditor);
        this.hasUndo = true;
    }

    public redo(vditor: IVditor) {
        const state = this.redoStack.pop();
        if (!state) {
            return;
        }
        this.undoStack.push(state);
        this.renderDiff(state, vditor, true);
    }

    public recordFirstWbr(vditor: IVditor) {
        if (this.undoStack.length === 1) {
            const range = getSelection().getRangeAt(0).cloneRange();
            range.insertNode(document.createElement("wbr"));
            const cloneEditorElement = document.createElement("pre");
            cloneEditorElement.innerHTML = vditor.wysiwyg.element.innerHTML;
            addP2Li(cloneEditorElement);
            this.undoStack[0][0].diffs[0][1] = vditor.lute.SpinVditorDOM(cloneEditorElement.innerHTML);
            this.lastText = this.undoStack[0][0].diffs[0][1];
            setRangeByWbr(vditor.wysiwyg.element, range);
        }
    }

    public addToUndoStack(vditor: IVditor) {
        // wysiwyg/afterRenderEvent.ts 已经 debounce
        let range;
        if (getSelection().rangeCount !== 0 && !vditor.wysiwyg.element.querySelector("wbr")) {
            range = getSelection().getRangeAt(0).cloneRange();
            if (vditor.wysiwyg.element.contains(range.startContainer)) {
                range.insertNode(document.createElement("wbr"));
            }
        }
        const cloneEditorElement = document.createElement("pre");
        cloneEditorElement.innerHTML = vditor.wysiwyg.element.innerHTML;
        addP2Li(cloneEditorElement);
        const text = vditor.lute.SpinVditorDOM(cloneEditorElement.innerHTML);
        if (range) {
            setRangeByWbr(vditor.wysiwyg.element, range);
        }
        const diff = this.dmp.diff_main(text, this.lastText, true);
        const patchList = this.dmp.patch_make(text, this.lastText, diff);
        if (patchList.length === 0) {
            return;
        }
        this.lastText = text;
        this.undoStack.push(patchList);
        if (this.undoStack.length > this.stackSize) {
            this.undoStack.shift();
        }
        if (this.hasUndo) {
            this.redoStack = [];
            this.hasUndo = false;
            disableToolbar(vditor.toolbar.elements, ["redo"]);
        }

        if (this.undoStack.length > 1) {
            enableToolbar(vditor.toolbar.elements, ["undo"]);
        }
    }

    private renderDiff(state: patch_obj[], vditor: IVditor, isRedo: boolean = false) {
        let text;
        if (isRedo) {
            const redoPatchList = this.dmp.patch_deepCopy(state).reverse();
            redoPatchList.forEach((patch) => {
                patch.diffs.forEach((diff) => {
                    diff[0] = -diff[0];
                });
            });
            text = this.dmp.patch_apply(redoPatchList, this.lastText)[0];
        } else {
            text = this.dmp.patch_apply(state, this.lastText)[0];
        }

        this.lastText = text;

        vditor.wysiwyg.element.innerHTML = text;
        vditor.wysiwyg.element.querySelectorAll(".vditor-wysiwyg__block").forEach((blockElement: HTMLElement) => {
            processCodeRender(blockElement, vditor);
        });
        setRangeByWbr(vditor.wysiwyg.element, vditor.wysiwyg.element.ownerDocument.createRange());
        scrollCenter(vditor.wysiwyg.element);
        afterRenderEvent(vditor, {
            enableAddUndoStack: false,
            enableHint: false,
            enableInput: true,
        });
        highlightToolbar(vditor);

        if (this.undoStack.length > 1) {
            enableToolbar(vditor.toolbar.elements, ["undo"]);
        } else {
            disableToolbar(vditor.toolbar.elements, ["undo"]);
        }

        if (this.redoStack.length !== 0) {
            enableToolbar(vditor.toolbar.elements, ["redo"]);
        } else {
            disableToolbar(vditor.toolbar.elements, ["redo"]);
        }
    }
}

export {WysiwygUndo};
