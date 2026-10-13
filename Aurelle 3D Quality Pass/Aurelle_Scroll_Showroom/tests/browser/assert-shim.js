function fail(m){throw new Error(m||'Assertion failed');}
function eq(a,b){if(a===b)return true;if(typeof a!=='object'||typeof b!=='object'||!a||!b)return Number.isNaN(a)&&Number.isNaN(b);const k=Object.keys(a);if(k.length!==Object.keys(b).length)return false;return k.every(x=>eq(a[x],b[x]));}
const assert=(v,m)=>{if(!v)fail(m);};
assert.ok=(v,m)=>{if(!v)fail(m);};
assert.equal=(a,b,m)=>{if(a!==b)fail(m||(a+' !== '+b));};
assert.deepEqual=(a,b,m)=>{if(!eq(a,b))fail(m||'deepEqual failed');};
export default assert;
