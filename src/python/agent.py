import sys
import subprocess
import ollama

# Dangerous commands that should never run
blocked_commands = [
    "del",
    "rmdir",
    "shutdown",
    "format",
    "taskkill",
    "powershell",
    "rm"
]

def is_safe(command):
    for blocked in blocked_commands:
        if blocked in command.lower():
            return False
    return True


def interpret_input(user_input):

    user_input = user_input.lower()

    # file listing
    if "list files" in user_input or "show files" in user_input or "show files in" in user_input:
        return "dir"

    # current folder
    if "current directory" in user_input or "show current directory" in user_input:
        return "cd"

    # create folders
    if "create a folder" in user_input or "create folder" in user_input or "make folder" in user_input:
        name = user_input.split()[-1]
        return f"mkdir {name}"

    # create files
    if "create a file" in user_input or "create file" in user_input or "make file" in user_input:
        name = user_input.split()[-1]
        return f"type nul > {name}"

    # internet check
    if "check internet" in user_input or "internet connection" in user_input:
        return "ping google.com"

    # system info
    if "system info" in user_input or "show system" in user_input:
        return "systeminfo"

    # ip address
    if "ip address" in user_input or "show ip" in user_input or "show ip address" in user_input:
        return "ipconfig"

    # python version
    if "python version" in user_input or "show python" in user_input:
        return "python --version"

    # node version
    if "node version" in user_input or "show node" in user_input:
        return "node --version"

    # installed packages
    if "show installed packages" in user_input or "installed packages" in user_input:
        return "pip list"

    # package install / uninstall
    if user_input.startswith("install "):
        package = user_input.replace("install ", "").strip()
        if package:
            return f"pip install {package}"

    if user_input.startswith("uninstall "):
        package = user_input.replace("uninstall ", "").strip()
        if package:
            return f"pip uninstall -y {package}"

    # running processes
    if "running processes" in user_input or "list processes" in user_input:
        return "tasklist"

    # open ports (list listening sockets)
    if "open ports" in user_input or "check open ports" in user_input:
        return "netstat -an | find \"LISTEN\""

    # network interfaces
    if "network interfaces" in user_input or "show network" in user_input:
        return "ipconfig /all"

    # test connection endpoints
    if "test connection" in user_input or "ping" in user_input:
        if "github" in user_input:
            return "ping github.com"
        return "ping google.com"

    # development helpers
    if "generate requirements" in user_input or "requirements.txt" in user_input:
        return "pip freeze > requirements.txt"

    # Run a python script by name
    if user_input.startswith("run ") or user_input.startswith("execute ") or "run script" in user_input:
        # Direct file reference
        parts = user_input.split()
        for part in parts:
            if part.endswith(".py"):
                return f"python {part}"

        # Try to find a matching script by keyword
        import os
        cwd_files = [f for f in os.listdir(".") if f.endswith(".py")]
        for keyword in ["calculator", "joke", "hello", "webscraper", "password", "ascii", "scraper"]:
            if keyword in user_input:
                for f in cwd_files:
                    if keyword in f.lower():
                        return f"python {f}"

    return user_input

def create_file(user_input):

    words = user_input.split()

    if "create file" in user_input:

        filename = words[-1]

        with open(filename, "w") as f:
            f.write("")

        return f"File '{filename}' created successfully."

    return None


def install_package(user_input):

    if "install package" in user_input:

        package = user_input.split()[-1]

        command = f"pip install {package}"

        return run_command(command)

    return None


def open_app(user_input):

    apps = {
        "open chrome": "start chrome",
        "open vscode": "code",
        "open notepad": "notepad",
        "open calculator": "calc"
    }

    user_input = user_input.lower()

    for key in apps:
        if key in user_input:
            return run_command(apps[key])

    return None


def run_command(command, retry_on_missing_module=True):

    if not is_safe(command):
        return "Command blocked for safety."

    try:
        result = subprocess.check_output(
            command,
            shell=True,
            stderr=subprocess.STDOUT,
            text=True
        )

        # If command runs but produces no output, show a helpful placeholder.
        if not result.strip():
            return "(command executed successfully; no output)"

        return result

    except subprocess.CalledProcessError as e:
        output = e.output

        # Provide a clearer error when the command is not found.
        if "is not recognized as an internal or external command" in output:
            return "Command not found. Try another command."

        # Auto-install missing Python modules (e.g., "No module named 'pyfiglet'")
        if retry_on_missing_module and "No module named" in output:
            missing = None
            for part in output.split():
                if part.startswith("'", 0) and part.endswith("'"):
                    missing = part.strip("'")
                    break
            if missing:
                install_cmd = f"pip install {missing}"
                try:
                    subprocess.check_output(install_cmd, shell=True, stderr=subprocess.STDOUT, text=True)
                except subprocess.CalledProcessError:
                    pass
                return run_command(command, retry_on_missing_module=False)

        # If there's no output but failure, still show something.
        return output or "(command failed with no output)"

def write_file(filename, content):

    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)

        return f"File '{filename}' written successfully."

    except Exception as e:
        return f"Error writing file: {e}"

def ai_plan_task(user_goal):

    prompt = f"""
You are an AI coding agent running on Windows.

If the goal requires creating code files, respond in this format:

FILE: filename.py
CODE:
<python code here>

Example:

FILE: main.py
CODE:
print("Hello World")

Goal: {user_goal}
"""

    response = ollama.chat(
        model="llama3",
        messages=[{"role": "user", "content": prompt}]
    )

    return response["message"]["content"]

import re

def execute_plan(plan):

    lines = plan.split("\n")
    results = []

    for line in lines:

        if "STEP" not in line:
            continue

        # extract command after STEP:
        command = line.split(":",1)[1].strip()

        # remove backticks and quotes
        command = command.replace("`","")
        command = command.replace('"',"")
        command = command.replace("'","")

        # remove extra spaces
        command = command.strip()

        # convert Linux commands → Windows
        if command.startswith("touch"):
            filename = command.split()[1]
            command = f"type nul > {filename}"

        # skip invalid instructions
        if any(word in command.lower() for word in ["input","editor","code"]):
            continue

        print(f"\n$ {command}")

        output = run_command(command)

        results.append(output)

    return "\n".join(results)

def parse_ai_code(ai_output):

    lines = ai_output.split("\n")

    filename = None
    code_lines = []
    capture = False

    for line in lines:

        if line.startswith("FILE:"):
            filename = line.replace("FILE:", "").strip()

        elif line.startswith("CODE:"):
            capture = True
            continue

        elif capture:
            # Strip markdown code fences if present
            if line.strip().startswith("```"):
                continue
            code_lines.append(line)

    code = "\n".join(code_lines).strip("\n")

    return filename, code


if __name__ == "__main__":

    user_input = sys.argv[1].lower()

    # Detect AI coding tasks
    if any(word in user_input for word in ["create", "build", "generate", "write"]):

        print("AI generating code...\n")

        ai_output = ai_plan_task(user_input)

        filename, code = parse_ai_code(ai_output)

        if filename and code:

            result = write_file(filename, code)
            print(result)

            print(f"\nRun it with: python {filename}")

        else:
            print("AI did not return valid code.")

    else:

        file_result = create_file(user_input)
        install_result = install_package(user_input)
        app_result = open_app(user_input)

        if file_result:
            print(file_result)

        elif install_result:
            print(install_result)

        elif app_result:
            print(app_result)

        else:
            command = interpret_input(user_input)
            output = run_command(command)
            print(output)

print("Task completed.")