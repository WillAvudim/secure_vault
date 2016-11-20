(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
// http://eslint.org/docs/user-guide/configuring.html#configuring-rules
/*eslint no-console:0 quotes:0*/
/*global
Vue $
*/

// index.js
console.log('Client-side JS is working.');

// -------------------------------------------------------------------------
const LOCAL_STORAGE_ENTRY = "info";
const NEW_SERVICE_LIST = {
    global_notes: "",
    services: []
};

$(function () {
    if ($("#qunit").length > 0) {
        // In unit test mode; qunit will take over.
        return;
    }

    // Temporarily skip password screens.
    //const value = mls_ReadValue(LOCAL_STORAGE_ENTRY, "asdfasdf");
    //DisplayServiceList("asdfasdf", value.GetNextVersion, value.value);
    if (!mls_DoesRecordExist(LOCAL_STORAGE_ENTRY)) {
        ManagePassword("new");
    } else {
        ManagePassword("ask_existing");
    }
});

function ManagePassword(mode /* = new | ask_existing | change */) {
    //$("#screen-container").children().remove();
    $("#screen-container").html('<div id="screen"></div>');
    new Vue({
        data: {
            mode: mode,
            original_password: "",
            password: "",
            confirm_password: "",
        },
        methods: {
            OK: function () {
                if (this.mode === "new") {
                    mls_WriteValue(LOCAL_STORAGE_ENTRY, this.password, 1, _.cloneDeep(NEW_SERVICE_LIST));
                }

                try {
                    const vault = mls_ReadValue(LOCAL_STORAGE_ENTRY, this.password);
                    this.$destroy();
                    DisplayServiceList(this.password, vault.GetNextVersion, vault.value);
                } catch (e) {
                    // Incorrect password - noop.
                    // debugger;
                }
            }
        },
        computed: {
            disable_OK: function () {
                if (this.mode === "new") {
                    return !this.password || !!this.error_message;
                }
            },
            error_message: function () {
                if (!this.password) {
                    return "Password cannot be empty";
                }
                if (this.mode !== "ask_existing") {
                    if (this.password != this.confirm_password) {
                        return "Passwords must match";
                    }
                }
                return "";
            }
        },
        el: "#screen",
        render: global_render_registry["login"].render,
        staticRenderFns: global_render_registry["login"].staticRenderFns
    });
}

// ==========================================================
// Local Storage API
// ==========================================================

const CORRECTNESS_TAG = "THIS_RECORD_IS_CORRECT";

// mls == my_local_storage
function mls_DoesRecordExist(record_name) {
    return localStorage.getItem(record_name) !== null;
}

// Attempts to read a value from the storage.
// Throws a string error message (to be displayed) if unable to read or decrypt the value.
// Otherwise, returns the unencrypted value (a previosly written object) and
// a function that can be used to generate further versions.
function mls_ReadValue(record_name, password) {
    const encrypted_blob = localStorage.getItem(record_name);
    const unencrypted_string = Decrypt(encrypted_blob, password);

    const unencrypted_envelope = JSON.parse(unencrypted_string);
    if (unencrypted_envelope.correctness_tag !== CORRECTNESS_TAG) {
        throw "Unable to confirm correctness of the unencrypted content.";
    }

    let current_version = unencrypted_envelope.version;
    return {
        // Unencrypted version (object).
        value: unencrypted_envelope.written_object_value,
        GetNextVersion: () => ++current_version
    };
}

// Writes the record into the current global record as well as into a versioned 
// entry under a separate record version ID.
// Maintains every KEEP_EVERY_NTH_VERSION record forever.
// Maintains DELETE_NTH_OLD_VERSION recent versions.FromTextChanges
function mls_WriteValue(record_name, password, version, new_value) {
    const new_envelope = {
        version: version,
        written_object_value: new_value,
        correctness_tag: CORRECTNESS_TAG
    };
    const encrypted_content = Encrypt(JSON.stringify(new_envelope), password);

    // Write twice.
    localStorage.setItem(record_name, encrypted_content);
    if (localStorage.getItem(record_name) !== encrypted_content) {
        throw "Record cannot be read back.";
    }

    localStorage.setItem(record_name + "_" + version, encrypted_content);
    if (localStorage.getItem(record_name + "_" + version) !== encrypted_content) {
        throw "Duplicate record cannot be read back.";
    }

    // Erasing all older versions leaving only every 10th forever.
    const KEEP_EVERY_NTH_VERSION = 10;
    const DELETE_NTH_OLD_VERSION = 10;
    if ((version % KEEP_EVERY_NTH_VERSION) !== 0) {
        const full_record_name = record_name + "_" + (
            version - DELETE_NTH_OLD_VERSION);
        if (localStorage.getItem(full_record_name) !== null) {
            //console.log("Erasing the record: '" + full_record_name + "'");
            localStorage.removeItem(full_record_name, null);
        }
    }
}

// ==========================================================
// Service List.
// ==========================================================
const NEW_SERVICE = {
    name: "",
    notes: "",
    fields: []
};

function DisplayServiceList(password, GetNextVersion, service_state) {
    $("#screen-container").html('<div id="screen"></div>');
    let saved_service_state = _.cloneDeep(service_state);
    new Vue({
        data: $.extend({
            global_notes: "",
            services: [{
                name: "Sample service",
                notes: "Something important",
                fields: [{
                    name: "field1",
                    value: "field-value",
                    hide: false
                }]
            }],
            saved_indication: false
        }, service_state),
        methods: {
            AddService: function () {
                DisplayServiceEditingDialog(NEW_SERVICE, "new")
                    .then(new_service => {
                        this.services.push(new_service);
                        this.EventuallySave();
                    });
            },
            EditService: function (index) {
                DisplayServiceEditingDialog(this.services[index], "edit")
                    .then(updated_service => {
                        Vue.set(this.services, index, updated_service);
                        this.EventuallySave();
                    });
            },
            CopyValue: function (service_index, field_index) {
                CopyToClipboard(this.services[service_index].fields[field_index].value);
            },
            EventuallySave: _.debounce(function () {
                const new_state = {
                    global_notes: this.global_notes,
                    services: _.cloneDeep(this.services)
                };
                if (!_.isEqual(new_state, saved_service_state)) {
                    mls_WriteValue(LOCAL_STORAGE_ENTRY, password, GetNextVersion(), new_state);
                    saved_service_state = new_state;

                    // Display the Saved indication for 1s.
                    this.saved_indication = true;
                    _.delay(() => { this.saved_indication = false }, 1000); // If > 1500, will have to hide via _.debounce.
                }
            }, 1500 /*ms*/)
        },
        watch: {
            "global_notes": function () {
                this.EventuallySave();
            }
        },
        el: ("#screen"),
        render: global_render_registry["list"].render,
        staticRenderFns: global_render_registry["list"].staticRenderFns
    });
}

// ==========================================================
// Service dialog.
// ==========================================================
const NEW_FIELD = {
    name: "",
    value: "",
    hide: false
};

// Returns the promise.
function DisplayServiceEditingDialog(service_value, mode) {
    return new Promise(function (resolve, reject) {
        $("#dialog-container").html('<div class="modal"><div id="dialog"></div></div>');
        const DestroyDialog = () => $("#dialog-container").html('');

        const vm = new Vue({
            data: _.cloneDeep(service_value),
            methods: {
                "GeneratePassword": function (index) {
                    this.fields[index].value = GenerateSolidPassword();
                },
                "AddNewField": function () {
                    this.fields.push(_.cloneDeep(NEW_FIELD));
                },
                "Delete": function (index) {
                    this.fields.splice(index, 1 /* delete_count, e1, e2, e3... */);
                },
                "OK": function () {
                    this.$destroy();
                    DestroyDialog();
                    resolve(this.$data);
                },
                "Cancel": function () {
                    this.$destroy();
                    DestroyDialog();
                    reject(null);
                }
            },
            el: ("#dialog"),
            render: global_render_registry["edit"].render,
            staticRenderFns: global_render_registry["edit"].staticRenderFns
        });
    });
};

function GenerateSolidPassword() {
    // 15 symbols
    // All classes are represented: digits, lower-case, upper-case, !@#$%^&*=-+
    // No: O0o LIli|1
    const characters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
    const digits = "23456789";
    const symbols = "@#$%&*=-+";

    const all = characters + digits + symbols;

    function GetSinglePassword() {
        let password = "";
        for (let i = 0; i < 15; ++i) {
            password += all[Math.floor(Math.random() * all.length)];
        }
        return password;
    }

    function includes( /*string*/ password, /*string*/ characters, /*int*/ min_entries) {
        let total_entries = 0;
        for (let i = 0; i < password.length; ++i) {
            for (let o = 0; o < characters.length; ++o) {
                if (password[i] == characters[o]) {
                    if (++total_entries > 1) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    for (; ;) {
        const password = GetSinglePassword();
        if (!includes(password, digits, 2)) {
            continue;
        }
        if (!includes(password, symbols, 2)) {
            continue;
        }

        // At least 2 digits, 2 symbols and the length is 15.
        return password;
    }
}

},{}]},{},[1]);
