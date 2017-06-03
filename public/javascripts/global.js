function getCookiePairs() {
    var pairStrings = document.cookie.split("; ");
    var pairs = {};
    for (var i in pairStrings) {
        var pairStr = pairStrings[i];
        console.log(pairStr);
        var pair = pairStr.split("=", 2);
        pairs[pair[0]] = pair[1];
    }
    return pairs;
}
function dumpCookie(key) {
    document.cookie = key+'=';
}