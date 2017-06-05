with open('./mainlisting.routes', 'r') as content_file:
    content = content_file.read()

with open('./mainlisting.genroutes', 'w') as outfile:
    content = content.split("\n")
    prefix = []
    for line in content:
        line = line.strip()
        print("'", line, "'")
        if not (line.startswith("/") or line.startswith("#") or len(line) is 0):
            # is a path
            line = line.split()
            outfile.write("router." + line[0].lower() + "('" + line[1] + "', function(req, res, next){\n\t\n});\n")
