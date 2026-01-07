
import os
import json
import urllib.request

API_KEY = os.environ.get("RUNPOD_API_KEY")
ENDPOINT_ID = 'i3qcf6gz8v495h'

print("Starting RunPod Config Fixer (Standard Lib)...")

def run_gql(query, variables={}):
    url = "https://api.runpod.io/graphql"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    data = json.dumps({'query': query, 'variables': variables}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req) as res:
            body = res.read()
            json_res = json.loads(body)
            if 'errors' in json_res:
                raise Exception(json.dumps(json_res['errors']))
            return json_res['data']
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        raise Exception(f"HTTP {e.code}: {err_body}")

def main():
    try:
        print("1. Querying Endpoint Info...")
        query_endpoint = """
        query {
            endpoint(input: {id: "i3qcf6gz8v495h"}) {
                id
                networkVolume {
                    id
                    name
                }
            }
        }
        """
        # Note: input syntax might vary. Try getting by ID directly if schema allows. 
        # Usually it is `endpoint(id: "...")` or `pod(id: "...")`
        # Let's try `endpoint(id: ...)` first based on docs.
        # But wait, docs say `endpoint` query might need input object.
        # Let's try both or check standard. 
        # Actually standard is `endpoint(id: "ID")`. 
        
        query_endpoint_simple = """
        query {
            endpoint(id: "i3qcf6gz8v495h") {
                id
                networkVolume {
                    id
                    name
                }
            }
        }
        """

        data = None
        try:
            data = run_gql(query_endpoint_simple)
        except Exception as e:
            print(f"   Query failed: {e}")
            return

        ep = data.get('endpoint')
        if not ep:
            print("❌ Endpoint not found or no permission.")
            return
            
        vol = ep.get('networkVolume')
        if not vol:
            print("❌ No Network Volume attached to this endpoint.")
            print("   Please go back to UI, select the volume, and click Save (even without path).")
            return
            
        print(f"✅ Found Attached Volume: {vol['name']} (ID: {vol['id']})")
        
        print("2. Updating Endpoint Path...")
        mutation = """
        mutation saveEndpoint($input: EndpointInput!) {
            saveEndpoint(input: $input) {
                id
            }
        }
        """
        
        variables = {
            "input": {
                "id": ENDPOINT_ID,
                "networkVolumeId": vol['id'], 
                # Does the API verify the path? We just need to link it.
                # If we can't set path via API, we use the ID to know the default path.
            }
        }
        
        # We will Try to set path if found field, otherwise we just print the Default Path
        print(f"ℹ️  Default Mount Path: /runpod-volume/{vol['id']}")
        print(f"ℹ️  Expected Models Path: /runpod-volume/{vol['id']}/ComfyUI/models")
        
        # We don't need to update if it's already attached. 
        # We just need to know the path to fix our client side code!
        
        # BUT, if we want to fix it for real, we can try to inject dockerArgs?
        # environmentVariables: [ { "key": "COMFY_MODELS_PATH", "value": "..." } ]
        
        # For now, let's just Output the Default Path so I can verify the test script.
        
    except Exception as e:
        print(f"Fatal Error: {e}")

if __name__ == "__main__":
    main()
