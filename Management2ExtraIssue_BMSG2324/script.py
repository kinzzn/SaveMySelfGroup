import re
import os

def modify_markdown_file(filepath):
    """
    Modifies a Markdown file according to a set of specific rules.

    Args:
        filepath (str): The path to the Markdown file (e.g., './talkabout/text.md').
    """
    try:
        # Ensure the directory exists
        directory = os.path.dirname(filepath)
        if directory and not os.path.exists(directory):
            print(f"Error: Directory '{directory}' does not exist.")
            return

        # Read the original content of the file
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        print(f"Successfully read content from '{filepath}'. {content[:50]}...")  # Print first 50 characters for debugging
        
        # --- Whitelist Protection: Protect special terms from character replacement ---
        # Create a whitelist of terms that should not be affected by character replacement rules
        whitelist_terms = [
            'D.U.N.K.Showcase',
            'Novel Core',
            'BE:FIRST',
            'BMSG FES',
            'THE GAME CENTER',
            'THE LAST PIECE',
            'THE FIRST',
            'BMSG POSSE',
            'Name Tag',
            'Aile The Shota',
            'edhiii boi',
            'No No Girls'
        ]
        
        # Create placeholders for whitelist terms
        placeholder_map = {}
        for i, term in enumerate(whitelist_terms):
            placeholder = f'__WHITELIST_PLACEHOLDER_{i}__'
            placeholder_map[placeholder] = term
            content = content.replace(term, placeholder)
        
        print("Applied Whitelist Protection: Protected special terms from character replacement.")
        
        # --- Rule 6: Remove unnecessary line breaks (OCR cleanup) ---
        # Remove line breaks between text characters, but keep line breaks after punctuation
        # This rule should be applied early to clean up OCR artifacts before other processing
        punctuation = '。，、；：！？…—————""''（）【】《》〈〉「」『』＂＇．，；：！？'
        lines = content.split('\n')
        cleaned_lines = []
        i = 0
        
        while i < len(lines):
            current_line = lines[i].strip()
            if not current_line:  # Skip empty lines
                cleaned_lines.append('')
                i += 1
                continue
                
            # Check if we should merge with next line
            merged_line = current_line
            while i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if not next_line:  # Next line is empty, don't merge
                    break
                    
                # If current line doesn't end with punctuation, merge with next line
                if not any(current_line.endswith(p) for p in punctuation):
                    merged_line += next_line
                    i += 1  # Skip the next line since we merged it
                    current_line = next_line  # Update current_line for next iteration
                else:
                    # Current line ends with punctuation, don't merge
                    break
                    
            cleaned_lines.append(merged_line)
            i += 1
        
        # Rejoin the cleaned lines
        content = '\n'.join(cleaned_lines)
        print("Applied Rule 6: Removed unnecessary line breaks between text, kept breaks after punctuation.")

        # --- Rule 7: Remove multiple consecutive line breaks ---
        # Replace multiple consecutive line breaks with a single line break
        content = re.sub(r'\n{2,}', '\n', content)
        print("Applied Rule 7: Replaced multiple consecutive line breaks with single line breaks.")

        # --- Rule 1: Replace ' ' with '' (Applied during whitelist protection) ---
        # WARNING: This rule will remove ALL spaces from your text, potentially
        # making it unreadable. Applied here to avoid affecting whitelist terms.
        content = content.replace(' ', '')
        print("Applied Rule 1: Removed all spaces. (WARNING: This may make text unreadable).")

        # --- Rule 5: Convert half-width punctuation to full-width (Applied during whitelist protection) ---
        # Convert punctuation marks while whitelist terms are protected
        content = content.replace('?', '？').replace('!', '！').replace(':', '：').replace('.', '。')
        print("Applied Rule 5: Converted half-width punctuation to full-width.")

        # --- Rule 2: Process line by line for dash replacement ---
        # These rules depend on the concept of a "line" or "paragraph beginning",
        # which is clearer after line break normalization.
        lines = content.split('\n')
        modified_lines = []
        for line in lines:
            # Rule 2: If '-' is at the beginning of the paragraph, replace '-' with '————'
            # This applies to lines that start with '-' after normalization.
            if line.startswith('-'):
                line = '————' + line[1:]
                # print(f"Applied Rule 2 to line: {line[:50]}...") # Debugging line
            modified_lines.append(line)
        content = '\r\n'.join(modified_lines)
        print(f"Applied Rule 2: Processed lines for dash replacement. {content[:50]}...")  # Print first 50 characters for debugging

        # Rule 4: Convert 'from SKY-HI' sections to blockquote format
        # Find 'from SKY-HI' or 'fromSKY-HI' and convert to blockquote with H3 heading
        # All subsequent text until the next major section becomes part of the blockquote
        
        # Split content into lines for processing
        lines = content.split('\r\n')
        processed_lines = []
        in_skyhi_section = False
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Check if this line contains 'from SKY-HI' or 'fromSKY-HI'
            if 'fromSKY-HI' in line or 'from SKY-HI' in line:
                # Start a new blockquote section
                processed_lines.append('')  # Add empty line before blockquote
                processed_lines.append('> ### from SKY-HI')
                in_skyhi_section = True
                
                # If there's additional text on the same line after 'from SKY-HI', add it as blockquote
                remaining_text = line.replace('fromSKY-HI', '').replace('from SKY-HI', '').strip()
                if remaining_text:
                    processed_lines.append(f'> {remaining_text}')
                    
            elif in_skyhi_section:
                # We're in a SKY-HI section, check if we should end it
                if line == '' or line.startswith('—') or (len(line) > 0 and not any(char in line for char in '。，、；：！？…—————""''（）【】《》〈〉「」『』＂＇．，；：！？abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン')):
                    # This looks like a section break, end the SKY-HI section
                    in_skyhi_section = False
                    processed_lines.append('')  # Add empty line after blockquote
                    processed_lines.append(line)
                else:
                    # Continue the blockquote
                    if line:  # Only add non-empty lines to blockquote
                        processed_lines.append(f'> {line}')
                    else:
                        processed_lines.append('>')  # Empty blockquote line
                        
            else:
                # Normal line, not in SKY-HI section
                processed_lines.append(line)
        
        content = '\r\n'.join(processed_lines)
        print("Applied Rule 4: Converted 'from SKY-HI' sections to blockquote format.")

        # --- Restore Whitelist Terms ---
        # Restore the protected terms from placeholders
        for placeholder, original_term in placeholder_map.items():
            content = content.replace(placeholder, original_term)
        print("Restored whitelist terms: Protected terms have been restored to their original form.")

        print("Final content after all modifications:")
        print(content)
        # Write the modified content back to the file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"Successfully modified and saved content to '{filepath}'.")

    except FileNotFoundError:
        print(f"Error: The file '{filepath}' was not found.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# Example usage:
# Assuming your file is located at './01_TalkAboutBMSG/03.md' relative to where the script is run.
# You can change this path if your file is elsewhere.
# file_to_modify = './01_TalkAboutBMSG/03.md'
files = [
    # './01_TalkAboutBMSG/20_RUI.md',
    # './01_TalkAboutBMSG/21_TAIKI.md',
    # './01_TalkAboutBMSG/22_KANON.md',
    # './01_TalkAboutBMSG/23_Trainee.md',
    # './02_Interview/01_NovelCore/01_NovelCore.md',
    './02_Interview/02_BEFIRST/01_BefirstMemberInterview.md',
    # './02_Interview/02_BEFIRST/02_BefirstGroupInterview.md',
    # './02_Interview/02_BEFIRST/03_SkyHiInterviewAboutBefirst.md',
    # './02_Interview/03_MAZZEL/01_MazzelMemberInterview.md',
    # './02_Interview/03_MAZZEL/02_MazzelGroupInterview.md',
    # './02_Interview/03_MAZZEL/03_SkyhiInterviewAboutMazzel.md',
    # './03_Chronicle/01_Chronicle.md',
    # './04_EditorsNote/04_EditorsNote.md',
]
for file_to_modify in files:
    modify_markdown_file(file_to_modify)
