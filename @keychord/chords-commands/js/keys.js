//#region src/js/keys.ts
function buildAction() {
  return function action(keys) {
    console.log(keys);
  };
}
//#endregion
export { buildAction as default };
