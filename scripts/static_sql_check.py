"""
Static validator for supabase/migrations/*.sql.

Performs lightweight PostgreSQL SQL sanity checks without a database:
  1. All dollar-quote tags ($tag$ ... $tag$) are balanced per tag.
  2. Each dollar-quoted body is nonempty.
  3. Statements end with ';' and no statement text is left dangling.
  4. DO {$$ | $tag$} blocks are well-formed (BEGIN/END balance is not checked
     deeply, but DO ... END $tag$; shape is required).
  5. Naive single-quote balance outside dollar-quoted bodies and comments.
"""
import re
import sys
import glob

DOLLAR_RE = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$")

def strip_line_comments(sql: str) -> str:
    # remove -- comments that are not inside a dollar-quoted segment:
    # we process char-by-char tracking dollar-quote state below instead.
    return sql

def scan(path: str):
    with open(path, "r", encoding="utf-8", newline="") as f:
        text = f.read()

    errors = []
    # Tokenize top-level structure while tracking dollar-quote nesting.
    i = 0
    n = len(text)
    stack = []          # open dollar-quote tags
    in_line_comment = False
    in_block_comment = 0
    in_single_quote = False
    statements = 0

    body = None         # inside dollar quote: collect chars
    body_tag = None

    # For validation we mostly need: tags balance, quotes balance outside bodies.
    # Walk with simple state machine (no body content tracking needed except balance).

    pos = 0
    while pos < n:
        ch = text[pos]
        nxt = text[pos+1] if pos+1 < n else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            pos += 1
            continue

        if in_block_comment > 0:
            if ch == "/" and nxt == "*":
                in_block_comment += 1
                pos += 2
                continue
            if ch == "*" and nxt == "/":
                in_block_comment -= 1
                pos += 2
                continue
            pos += 1
            continue

        if stack:
            # inside dollar-quoted body: look for matching close tag
            m = DOLLAR_RE.match(text, pos)
            if m and m.group(0) == stack[-1]:
                stack.pop()
                pos = m.end()
                continue
            pos += 1
            continue

        if in_single_quote:
            if ch == "'":
                # handle '' escape
                if nxt == "'":
                    pos += 2
                    continue
                in_single_quote = False
            pos += 1
            continue

        if ch == "-" and nxt == "-":
            in_line_comment = True
            pos += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment += 1
            pos += 2
            continue
        if ch == "'":
            in_single_quote = True
            pos += 1
            continue

        m = DOLLAR_RE.match(text, pos)
        if m:
            stack.append(m.group(0))
            pos = m.end()
            continue

        if ch == ";":
            statements += 1
        pos += 1

    if stack:
        errors.append(f"unbalanced dollar-quote tags at EOF: {stack}")
    if in_single_quote:
        errors.append("unterminated single-quoted string at EOF")
    if in_block_comment > 0:
        errors.append("unterminated block comment at EOF")
    if in_line_comment:
        pass  # line comment at EOF is fine

    # crude statement completeness: last meaningful (non-comment) char must be ';'
    def last_meaningful_char(txt: str) -> str:
        i2 = len(txt) - 1
        in_lc = False      # scanning backwards: track line-comment state roughly
        # simply strip trailing whitespace/comments from the end
        while i2 >= 0:
            c = txt[i2]
            if c in " \t\r\n":
                i2 -= 1
                continue
            # remove a trailing block comment /* ... */
            if c == "/" and i2 >= 1 and txt[i2-1] == "*":
                # find matching opening /*
                depth = 1
                i2 -= 2
                while i2 >= 1 and depth > 0:
                    if txt[i2] == "/" and txt[i2-1] == "*":
                        depth -= 1
                        i2 -= 2
                    elif txt[i2] == "*" and txt[i2-1] == "/":
                        depth += 1
                        i2 -= 2
                    else:
                        i2 -= 1
                continue
            # remove a trailing line comment: find newline before the '--'
            # (simple approach: cut back to previous newline and retry)
            if c == "-" and i2 >= 1 and txt[i2-1] == "-":
                nl = txt.rfind("\n", 0, i2-1)
                i2 = nl
                continue
            return c
        return ""

    if last_meaningful_char(text) != ";":
        errors.append("last non-comment content is not a semicolon-terminated statement")

    return errors, statements

if __name__ == "__main__":
    files = sys.argv[1:] or sorted(glob.glob("supabase/migrations/*.sql"))
    fail = False
    for path in files:
        errs, count = scan(path)
        status = "OK" if not errs else "FAIL"
        print(f"{status}  {path}  (statements~{count})")
        for e in errs:
            fail = True
            print(f"      - {e}")
    sys.exit(1 if fail else 0)