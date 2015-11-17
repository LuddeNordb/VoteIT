$(document).ready(function() {
    var counter = 2;

    $("#addButton").click(function() {
        counter++;
        var newTextBoxDiv = $(document.createElement('div'))
            .attr("id", 'TextBoxDiv' + counter);

        newTextBoxDiv.after().html(
          '<label>Option #' + (counter) + ' : </label>' +
          '<input type="text" name="textbox[]" id="textbox' + counter + '" value="" placeholder="Write an option.." >'
          );

        newTextBoxDiv.appendTo("#TextBoxesGroup");

    });

    $("#removeButton").click(function() {
        if (counter == 2) {
            alert("Need more than two options");
            return false;
        }

        $("#TextBoxDiv" + counter).remove();
        counter--;
    });

    $("#createvotebutton").click(function() {
        window.location = "/createVoteSession";
    });

    $("#printbutton").click(function() {
        if (confirm("This is going to regenerate new codes, are you sure?")) {
            window.location = "/admin/print";
        }
    });
});
