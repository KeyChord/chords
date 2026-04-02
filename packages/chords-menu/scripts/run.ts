import  buildMenuHandler  from '../src/js/menu.ts'
const menu= buildMenuHandler()
const result = await menu('by-index', "1")
console.log(result)