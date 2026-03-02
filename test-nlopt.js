const nlopt = require('nlopt-js');

async function test() {
    await nlopt.ready;
    const opt = new nlopt.Optimize(nlopt.Algorithm.LN_COBYLA, 2);
    console.log("Methods on opt:");
    for (const prop in opt) {
        if (typeof opt[prop] === 'function') {
            console.log(prop);
        }
    }
    console.log("Prototype methods on Optimize:");
    const proto = Object.getPrototypeOf(opt);
    for (const prop of Object.getOwnPropertyNames(proto)) {
        console.log(prop);
    }
    opt.delete();
}
test();
