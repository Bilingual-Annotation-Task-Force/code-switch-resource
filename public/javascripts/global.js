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
function addSubscrip(id) {
    console.log(id);
    jQuery.ajax({
        type: "PUT",
        url: "/client/subscribe/" + id
    });
    if (idSubList.indexOf(id) === -1) {
        idSubList.push(id);
    }
}
function removeSubscrip(id) {
    console.log(id);
    jQuery.ajax({
        type: "DELETE",
        url: "/client/subscribe/" + id
    });
    if (idSubList.indexOf(id) === -1) {
        idSubList.remove(idSubList.indexOf(id));
    }
}

var idSubList = [];
function fetchIdSubList(callback) {
    idSubList = [];
    jQuery.getJSON('/client/my-profile/corpora/subscribed/simple', function(data, state, jqXHR) {
        var subList = [];
        if (jqXHR.responseJSON.size !== 0) {
            subList = jqXHR.responseJSON;
        }
        for (var thing in subList) {
            idSubList.push(subList[thing]['_id']);
        }
        callback();
    });
}