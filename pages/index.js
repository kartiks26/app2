import { Authenticator } from "@aws-amplify/ui-react";
import {
  Amplify,
  API,
  withSSRContext,
  Auth,
  Hub,
  graphqlOperation,
} from "aws-amplify";
import Head from "next/head";
import awsExports from "../src/aws-exports";
import { createTodo } from "../src/graphql/mutations";
import { deleteTodo, updateTodo } from "../src/graphql/mutations";
import { listTodos } from "../src/graphql/queries";
import { GRAPHQL_AUTH_MODE } from "@aws-amplify/api";
import { useRouter } from "next/router";
import Image from "next/image";
import { GetServerSideProps } from "next";
import styles from "../styles/Home.module.css";
import { CognitoHostedUIIdentityProvider } from "@aws-amplify/auth";

import { useEffect, useState } from "react";
import { onCreateTodo } from "../src/graphql/subscriptions";

Amplify.configure({ ...awsExports, ssr: false });

export default function Home({ todos = [] }) {
  const router = useRouter();
  const [todo, setTodo] = useState(todos);
  const [user, setUser] = useState(null);
  const [customState, setCustomState] = useState(null);

  // useEffect(() => {
  //   const subscriptionss = API.graphql({
  //     query: onCreateTodo,
  //     authMode: GRAPHQL_AUTH_MODE.AMAZON_COGNITO_USER_POOLS,
  //   }).subscribe({
  //     next: ({ provider, value }) =>
  //       setTodo([...todo, value.data.onCreateTodo]),
  //     error: (error) => console.warn(error),
  //   });
  // }, []);
  const handelLoad = async () => {
    try {
      await API.graphql({
        query: listTodos,
        authMode: GRAPHQL_AUTH_MODE.AMAZON_COGNITO_USER_POOLS,
      }).then((response) => {
        setTodo(response.data.listTodos.items);
      });
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    handelLoad();
  }, [user]);

  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload: { event, data } }) => {
      switch (event) {
        case "signIn":
          setUser(data);
          break;
        case "signOut":
          setUser(null);
          break;
        case "customOAuthState":
          setCustomState(data);
      }
    });
    Auth.currentAuthenticatedUser()
      .then((currentUser) => setUser(currentUser))
      .catch(() => console.log("Not signed in"));

    return unsubscribe;
  }, []);
  async function handleCreateTodo(event) {
    event.preventDefault();

    const form = new FormData(event.target);

    try {
      const createInput = {
        name: form.get("title").toString(),
        description: form.get("content").toString(),
        severity: 5,
      };

      const request = await API.graphql({
        authMode: GRAPHQL_AUTH_MODE.AMAZON_COGNITO_USER_POOLS,
        query: createTodo,
        variables: {
          input: createInput,
        },
      }).then((response) => {
        setTodo([...todo, response.data.createTodo]);
      });
    } catch ({ errors }) {
      // throw new Error(errors[0].message);
    }
  }
  const HandelUpdateTodo = async (e, id) => {
    e.preventDefault();
    try {
      const updateInput = {
        id: id,
        name: "updated",
        description: "updated",
        owner: user?.getUsername(),
      };
      const request = await API.graphql({
        authMode: GRAPHQL_AUTH_MODE.AMAZON_COGNITO_USER_POOLS,
        query: updateTodo,
        variables: {
          input: updateInput,
        },
      }).then((response) => {
        setTodo(
          todo.map((item) => {
            if (item.id === id) {
              return response.data.updateTodo;
            }
            return item;
          })
        );
      });
    } catch (error) {}
  };
  const deleteTOdo = async (e, id) => {
    e.preventDefault();
    try {
      const request = await API.graphql({
        authMode: GRAPHQL_AUTH_MODE.AMAZON_COGNITO_USER_POOLS,
        query: deleteTodo,
        variables: {
          input: {
            id: id,
          },
        },
      });
      setTodo(todo.filter((todo) => todo.id !== id));
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <div className={styles.container}>
      <div className="App">
        {/* <button onClick={() => Auth.federatedSignIn()}>Open Hosted UI</button> */}
        <div
          style={{
            display: "flex",
            alignContent: "center",
            marginTop: "10px",
            justifyContent: "space-around",
            alignItems: "center",
          }}
        >
          {user ? (
            <button
              style={{
                height: "40px",
              }}
              onClick={() => Auth.signOut()}
            >
              Sign Out
            </button>
          ) : (
            <button
              style={{
                marginRight: "40px",
              }}
              onClick={() =>
                Auth.federatedSignIn({
                  provider: CognitoHostedUIIdentityProvider.Google,
                })
              }
            >
              <img
                style={{
                  padding: "5px",
                  height: "80px",
                }}
                src="/google.png"
              />
            </button>
          )}
          <div>
            <h4>{user && user?.attributes?.email}</h4>
            <code className={styles.code}>{todo.length}</code>
            Todos
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <form onSubmit={handleCreateTodo}>
          <h3 className={styles.title}>New Todo</h3>

          <fieldset>
            <legend>Title</legend>
            <input
              defaultValue={`Today, ${new Date().toLocaleTimeString()}`}
              name="title"
            />
          </fieldset>

          <fieldset>
            <legend>Content</legend>
            <textarea
              defaultValue="I built an Amplify app with Next.js!"
              name="content"
            />
          </fieldset>

          <button>Create Todo</button>
        </form>
        <div>
          {todo.map((tod) => (
            <div
              key={tod.id}
              style={{
                cursor: "pointer",
              }}
            >
              <h3
                onClick={(e) => {
                  HandelUpdateTodo(e, tod.id);
                }}
              >
                {tod.name}
              </h3>
              <p>{tod.description}</p>
              <p>{tod.severity}</p>
              <button onClick={(e) => deleteTOdo(e, tod.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>
      <main className={styles.main}></main>
    </div>
  );
}
