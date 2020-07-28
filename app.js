requirejs.config({
    baseUrl: "lib",
    paths: {
        app: "../app",
        jquery: "jquery-3.5.1.min",
        selection: "selection.min",
        dompurify: "purify",
    },
});

var maxWidth = [];

requirejs(["turndown"]);
requirejs(["joplin-turndown-plugin-gfm_mod"]);
requirejs(["dompurify"]);

require(["jquery"], function($) {
    $(document).ready(function() {
        $("#editableDiv").empty();
        var DOMPurify = require("dompurify");
        turndownService = new TurndownService();
        gfm = turndownPluginGfm.gfm;
        turndownService.use(gfm);
        // var maxWidth = [];
        var editableDiv = document.getElementById("editableDiv");
        var pastedData;
        var cleanPaste;

        function handlepaste(e) {
            var types, savedContent;

            // Browsers that support the 'text/html' type in the Clipboard API (Chrome, Firefox 22+)
            if (
                e &&
                e.clipboardData &&
                e.clipboardData.types &&
                e.clipboardData.getData
            ) {
                // Check for 'text/html' in types list. See abligh's answer below for deatils on
                // why the DOMStringList bit is needed. We cannot fall back to 'text/plain' as
                // Safari/Edge don't advertise HTML data even if it is available
                types = e.clipboardData.types;
                if (
                    (types instanceof DOMStringList && types.contains("text/html")) ||
                    (types.indexOf && types.indexOf("text/html") !== -1)
                ) {
                    // Extract data and pass it to callback
                    pastedData = e.clipboardData.getData("text/html");

                    setTimeout(function() {
                        cleanPaste = DOMPurify.sanitize(pastedData, {
                            ALLOWED_TAGS: [
                                "table",
                                "tbody",
                                "strong",
                                "em",
                                "br",
                                "p",
                                "td",
                                "tr", ,
                                "img",
                                "a",
                                "th",
                            ],
                        });
                        console.log(cleanPaste);
                        processPaste(editableDiv, cleanPaste);
                        //processPaste(editableDiv, pastedData);
                    }, 100);

                    // Stop the data from actually being pasted
                    e.stopPropagation();
                    e.preventDefault();
                    return false;
                }
            }

            // Everything else: Move existing element contents to a DocumentFragment for safekeeping
            savedContent = document.createDocumentFragment();
            while (editableDiv.childNodes.length > 0) {
                savedContent.appendChild(editableDiv.childNodes[0]);
            }

            // Then wait for browser to paste content into it and cleanup
            waitForPastedData(editableDiv, savedContent);
            return true;
        }

        function waitForPastedData(elem, savedContent) {
            // If data has been processes by browser, process it
            if (elem.childNodes && elem.childNodes.length > 0) {
                // Retrieve pasted content via innerHTML
                // (Alternatively loop through elem.childNodes or elem.getElementsByTagName here)
                var pastedData = elem.innerHTML;
                var cleanPaste = DOMPurify.sanitize(pastedData, {
                    ALLOWED_TAGS: [
                        "table",
                        "tbody",
                        "strong",
                        "em",
                        "br",
                        "p",
                        "td",
                        "tr",
                        "img",
                        "a",
                        "th",
                    ],
                });

                // Restore saved content
                elem.innerHTML = "";
                elem.appendChild(savedContent);

                // Call callback
                processPaste(elem, cleanPaste);
                //processPaste(elem, pastedData);
            }

            // Else wait 20ms and try again
            else {
                setTimeout(function() {
                    waitForPastedData(elem, savedContent);
                }, 20);
            }
        }

        function processPaste(elem, pastedData) {
            turndownService.addRule("as", {
                filter: "a",
                replacement: function(content) {
                    return " " + content + " ";
                },
            });

            turndownService.addRule("ima", {
                filter: "img",
                replacement: function(content) {
                    return "()";
                },
            });

            var markdown = turndownService.turndown(pastedData);

            //alert(markdown);
            $("#editableDiv").html(markdown);
            $("#editableDiv").addClass("box-wrap");
            $("#editableDiv").addClass("crosshair");

            elem.focus();
        }

        // Modern browsers. Note: 3rd argument is required for Firefox <= 6
        if (editableDiv.addEventListener) {
            editableDiv.addEventListener("paste", handlepaste, false);
        }
        // IE <= 8
        else {
            editableDiv.attachEvent("onpaste", handlepaste);
        }

        $("#clear").click(function() {
            $("#editableDiv").empty();
            $("#editableDiv").removeClass("box-wrap");
            $("#editableDiv").removeClass("crosshair");
            $("#finishedText").empty();
        });
        $("#row_lines").prop("checked", false);

        $("#row_lines").change(function() {
            $("#finishedText").empty();
            maxWidth = [];
            processPaste(editableDiv, pastedData);
        });
    });
});

// Selection library
// https://github.com/Simonwep/selection

require(["selection"], function(Selection) {
    var selection = Selection.create({
            // Class for the selection-area
            class: "selection",

            // All elements in this container can be selected
            selectables: [".box-wrap > div"],

            // The container is also the boundary in this case
            boundaries: [".box-wrap"],
        })
        .on("start", ({ inst, selected, oe }) => {
            // Remove class if the user isn't pressing the control key or ⌘ key
            if (!oe.ctrlKey && !oe.metaKey) {
                // Unselect all elements
                for (const el of selected) {
                    el.classList.remove("selected");
                    inst.removeFromSelection(el);
                }

                // Clear previous selection
                inst.clearSelection();
            }
        })
        .on("move", ({ changed: { removed, added } }) => {
            // Add a custom class to the elements that where selected.
            for (const el of added) {
                el.classList.add("selected");
            }

            // Remove the class from elements that where removed
            // since the last selection
            for (const el of removed) {
                el.classList.remove("selected");
            }
        })
        .on("stop", ({ inst }) => {
            // Remember selection in case the user wants to add smth in the next one
            inst.keepSelection();
            var selection = inst.getSelection();
            var line = 0;
            var x, y;
            var maxx = 0;
            var minx = 9999999;
            var newDiv = document.createElement("div");
            var newContent = document.createTextNode("\n");
            newDiv.appendChild(newContent);
            x = 0;
            y = 0;
            line = parseInt($(selection[0]).attr("y"));
            // Determine which columns where selected
            $.each(selection, function(index, item) {
                x = parseInt($(item).attr("x"));
                y = $(item).attr("y");

                if (x > maxx) {
                    maxx = x;
                }

                if (x < minx) {
                    minx = x;
                }

                if (y == line) {} else {
                    selection.splice(index, 0, newDiv);
                    line++;
                }
            });

            var finishedText = $(selection).text();
            finishedText = htmlEntities(finishedText);
            var final = "<pre>";
            var finishedLines = finishedText.split("\n");
            // var linesTrim = finishedLines.filter(function(el) {
            //     return el != "";
            // });

            // Create divider for heading rows
            var divider = "";
            var dividerPad = "";
            var partDivider = "";
            var leftPipe = "";
            var rightPipe = "";
            if ($("#row_lines").is(":checked")) {
                dividerPad = "-";
            } else {
                dividerPad = "=";
            }

            maxWidth.forEach((width) => {
                divider += "|" + dividerPad.repeat(width);
            });
            divider += "|";

            if (divider.substr(minx, 1) != "|") {
                partDivider = "|" + divider.substr(minx, maxx - minx + 1);
                leftPipe = "|";
            } else {
                partDivider = divider.substr(minx, maxx - minx + 1);
                leftPipe = "";
            }
            if (divider.substr(maxx, 1) != "|") {
                partDivider += "|";
                rightPipe = "|";
            } else {
                rightPipe = "";
            }

            maxx = 0;
            minx = 9999999;

            //linesTrim.forEach((line, lineNumber) => {
            finishedLines.forEach((line, lineNumber) => {
                final +=
                    "<span style='font-family:monospace;'>" +
                    leftPipe +
                    line +
                    rightPipe +
                    "</span><br/>";
                if (lineNumber == 0) {
                    final +=
                        "<span style='font-family:monospace;'>" +
                        // divider.padEnd(line.length, dividerPad) +
                        partDivider +
                        "</span><br/>";
                }
            });
            final += "</pre>";
            $("#finishedText").html(final);
        });

    function htmlEntities(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
});